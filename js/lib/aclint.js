/* =============================================================================
   Acceptance-criteria linter
   -----------------------------------------------------------------------------
   Bad test cases are usually a symptom: the acceptance criteria were untestable
   to begin with. This checks AC text for the patterns that make a QA guess, and
   turns each one into a question to put back to the author.

   Runs instantly, offline, with no tokens. Deliberately placed BEFORE the AI
   step - there is no point asking a model to infer a rule nobody wrote down.

   Bilingual on purpose: AC at a Vietnamese company is written in both, often in
   the same ticket.

   Pure functions, no DOM.
   ========================================================================== */
(function () {
  'use strict';

  /* Each rule: { id, level, en/vi label, ask (the question for the author),
                  test(line, ctx) -> bool, or docTest(allText) for whole-doc rules } */

  var VAGUE = [
    'nhanh', 'chậm', 'dễ dùng', 'thân thiện', 'hợp lý', 'phù hợp', 'đầy đủ', 'chính xác',
    'ổn định', 'mượt', 'tối ưu', 'bình thường', 'như cũ', 'tương tự', 'linh hoạt',
    'fast', 'slow', 'quick', 'user-friendly', 'user friendly', 'intuitive', 'reasonable',
    'appropriate', 'properly', 'correctly', 'as expected', 'as usual', 'similar', 'flexible',
    'seamless', 'robust', 'efficient', 'optimal', 'good performance', 'acceptable'
  ];

  var PERF_WORD = /\b(nhanh|chậm|hiệu năng|tải|thời gian|performance|fast|slow|load|latency|response time|timeout|concurrent)\b/i;
  var HAS_NUMBER = /\d/;
  var UNIT = /\b(ms|giây|s|phút|minute|second|hour|giờ|kb|mb|gb|record|bản ghi|user|người dùng|request|rps|tps|%)\b/i;

  var ETC = /(\bv\.?v\.?\b|\betc\b|\.\.\.|…|\bvà nhiều\b|\bnhư vậy\b|\bsimilar cases\b)/i;
  var TBD = /\b(tbd|to be defined|to be confirmed|chưa rõ|chưa xác định|cần xác nhận|todo|\?\?\?)\b/i;
  var AND_OR = /(\bvà\s*\/\s*hoặc\b|\band\s*\/\s*or\b|\bhoặc là\b)/i;

  /* No trailing \b on the English stems: acceptance criteria are written with
     inflected verbs ("rejects", "exceeds", "truncated"), and a trailing
     boundary made every one of them miss - which then reported perfectly good
     AC as having no error path at all. Leading \b is kept so "error" does not
     match inside "terror". Vietnamese short words keep both boundaries because
     "sai" would otherwise match inside English words like "said". */
  var NEGATIVE_HINT = /(\bnếu không\b|\bkhông hợp lệ\b|\bsai\b|\blỗi\b|\bthất bại\b|\btừ chối\b|\bhết hạn\b|\brỗng\b|\bvượt\b|\binvalid|\berror|\bfail|\breject|\bdeny|\bdenie|\bunauthor|\bforbidden|\bempt|\bexpir|\bexceed)/i;
  var LIMIT_WORD = /\b(tối đa|tối thiểu|không quá|ít nhất|max(imum)?|min(imum)?|up to|at least|maxlength|giới hạn|limit)\b/i;
  var OVERFLOW_HINT = /(\bvượt\b|\bquá\b|\bcắt\b|\btừ chối\b|\bexceed|\blonger than\b|\bmore than\b|\bover the limit\b|\btruncat|\breject)/i;

  var DATE_FIELD = /\b(ngày|date|thời gian|time|from|to|đến|từ|start|end|expiry|hạn)\b/i;
  var NUM_FIELD = /\b(số lượng|amount|quantity|số tiền|price|giá|tuổi|age|điểm|score|phần trăm|percent)\b/i;
  var BOUNDARY_HINT = /(>=|<=|>|<|\btừ\b.*\bđến\b|\bbetween\b|\brange\b|\btrong khoảng\b|\bkhông nhỏ hơn\b|\bkhông lớn hơn\b)/i;

  // "được + verb" with no actor, and English passive
  var PASSIVE_VI = /\b(được|bị)\s+(tạo|xoá|xóa|huỷ|hủy|cập nhật|gửi|duyệt|khoá|khóa|mở|lưu|hiển thị|chuyển|tính)\b/i;
  var PASSIVE_EN = /\b(is|are|was|were|be|been|being)\s+\w+(ed|n)\b/i;
  var ACTOR = /\b(bởi|by|user|người dùng|admin|hệ thống|system|qa|khách|customer|nhân viên|staff|api|service)\b/i;

  var PRONOUN = /^\s*(nó|chúng|cái đó|it|they|this|that|these|those)\b/i;

  var STRUCTURE = /\b(given|when|then|nếu|khi|thì|scenario|acceptance)\b/i;

  var RULES = [
    {
      id: 'vague',
      level: 'warn',
      en: 'Unmeasurable wording', vi: 'Diễn đạt không đo được',
      askEn: 'What exact value or observable behaviour counts as this?',
      askVi: 'Cụ thể là giá trị nào, hoặc hành vi quan sát được nào?',
      test: function (line) {
        var low = line.toLowerCase();
        var hit = VAGUE.filter(function (v) { return low.indexOf(v) !== -1; });
        return hit.length ? hit.slice(0, 3).join(', ') : false;
      }
    },
    {
      id: 'perfNoNumber',
      level: 'warn',
      en: 'Performance mentioned with no threshold', vi: 'Nói về hiệu năng nhưng không có ngưỡng',
      askEn: 'Within how many ms / for how many concurrent users?',
      askVi: 'Trong bao nhiêu ms / với bao nhiêu người dùng đồng thời?',
      test: function (line) {
        if (!PERF_WORD.test(line)) return false;
        if (HAS_NUMBER.test(line) && UNIT.test(line)) return false;
        return true;
      }
    },
    {
      id: 'etc',
      level: 'err',
      en: 'Open-ended list ("etc", "v.v.", "...")', vi: 'Danh sách bỏ lửng ("v.v.", "...")',
      // every ask is phrased as a question: these get pasted into a message
      // back to the author, where a statement reads as an accusation
      askEn: 'Which cases exactly? A tester cannot test "and so on".',
      askVi: 'Cụ thể gồm những trường hợp nào? Không thể kiểm thử "v.v.".',
      test: function (line) { return ETC.test(line); }
    },
    {
      id: 'tbd',
      level: 'err',
      en: 'Marked unresolved (TBD / chưa rõ / ???)', vi: 'Đang để ngỏ (TBD / chưa rõ / ???)',
      askEn: 'This is not ready to test. What is the decision?',
      askVi: 'Chưa thể test. Quyết định cuối là gì?',
      test: function (line) { return TBD.test(line); }
    },
    {
      id: 'andOr',
      level: 'warn',
      en: '"and/or" makes the rule unverifiable', vi: '"và/hoặc" làm quy tắc không kiểm chứng được',
      askEn: 'Is it one, the other, or both? They are different tests.',
      askVi: 'Là một cái, cái kia, hay cả hai? Đó là các case khác nhau.',
      test: function (line) { return AND_OR.test(line); }
    },
    {
      id: 'limitNoOverflow',
      level: 'warn',
      en: 'Limit stated, behaviour past the limit not stated', vi: 'Có giới hạn nhưng không nói khi vượt thì sao',
      askEn: 'What happens when the input exceeds it — rejected, truncated, warned?',
      askVi: 'Vượt giới hạn thì sao — từ chối, cắt bớt, hay cảnh báo?',
      test: function (line) { return LIMIT_WORD.test(line) && !OVERFLOW_HINT.test(line); }
    },
    {
      id: 'numNoBoundary',
      level: 'info',
      en: 'Numeric or date field with no range', vi: 'Trường số hoặc ngày không có khoảng giá trị',
      askEn: 'What is the valid range, and is each end inclusive?',
      askVi: 'Khoảng hợp lệ là gì, và hai đầu có tính vào không?',
      test: function (line) {
        return (NUM_FIELD.test(line) || DATE_FIELD.test(line)) && !BOUNDARY_HINT.test(line);
      }
    },
    {
      id: 'passive',
      level: 'info',
      en: 'Passive voice hides who acts', vi: 'Câu bị động che mất ai thực hiện',
      askEn: 'Who or what performs this — the user, an admin, or the system?',
      askVi: 'Ai thực hiện — người dùng, admin, hay hệ thống?',
      test: function (line) {
        return (PASSIVE_VI.test(line) || PASSIVE_EN.test(line)) && !ACTOR.test(line);
      }
    },
    {
      id: 'pronoun',
      level: 'info',
      en: 'Starts with a pronoun with no clear referent', vi: 'Mở đầu bằng đại từ không rõ chỉ cái gì',
      askEn: 'Which thing does this refer to?',
      askVi: 'Đại từ này chỉ đối tượng nào?',
      test: function (line) { return PRONOUN.test(line); }
    }
  ];

  /* Whole-document rules: about what is absent, so they cannot be per line. */
  var DOC_RULES = [
    {
      id: 'noNegative',
      level: 'err',
      en: 'No error or rejection path anywhere', vi: 'Không có luồng lỗi hay từ chối nào',
      askEn: 'What should happen when the input is invalid, missing, expired or unauthorised?',
      askVi: 'Khi dữ liệu sai, thiếu, hết hạn hoặc không có quyền thì hệ thống làm gì?',
      test: function (text) { return !NEGATIVE_HINT.test(text); }
    },
    {
      id: 'noStructure',
      level: 'info',
      en: 'No visible criteria structure', vi: 'Không thấy cấu trúc tiêu chí',
      askEn: 'Can this be rewritten as bullet points or Given/When/Then? Prose hides missing cases.',
      askVi: 'Có thể viết lại thành gạch đầu dòng hoặc Given/When/Then không? Văn xuôi dễ che mất case thiếu.',
      test: function (text, lines) {
        var bulleted = lines.filter(function (l) { return /^\s*([-*•]|\d+[.)])\s/.test(l); }).length;
        return bulleted < 2 && !STRUCTURE.test(text);
      }
    },
    {
      id: 'tooShort',
      level: 'warn',
      en: 'Very little detail for a testable requirement', vi: 'Quá ít chi tiết để kiểm thử được',
      askEn: 'This is a title, not acceptance criteria. What are the rules, data limits and error cases?',
      askVi: 'Đây là tiêu đề, chưa phải AC. Quy tắc, giới hạn dữ liệu và các case lỗi là gì?',
      test: function (text) { return text.replace(/\s+/g, ' ').trim().split(' ').length < 20; }
    }
  ];

  function lint(text, opts) {
    opts = opts || {};
    var vi = opts.lang === 'vi';
    var src = String(text == null ? '' : text);
    var lines = src.replace(/\r\n?/g, '\n').split('\n');
    var findings = [];

    lines.forEach(function (raw, i) {
      var line = raw.trim();
      if (!line || line.length < 3) return;
      RULES.forEach(function (r) {
        var hit = r.test(line);
        if (!hit) return;
        findings.push({
          id: r.id,
          level: r.level,
          line: i + 1,
          text: line.length > 160 ? line.slice(0, 159) + '…' : line,
          label: vi ? r.vi : r.en,
          ask: vi ? r.askVi : r.askEn,
          match: typeof hit === 'string' ? hit : ''
        });
      });
    });

    var nonEmpty = lines.filter(function (l) { return l.trim(); });
    DOC_RULES.forEach(function (r) {
      if (!src.trim()) return;
      if (!r.test(src, lines)) return;
      findings.push({
        id: r.id,
        level: r.level,
        line: 0,
        text: '',
        label: vi ? r.vi : r.en,
        ask: vi ? r.askVi : r.askEn,
        match: ''
      });
    });

    var counts = { err: 0, warn: 0, info: 0 };
    findings.forEach(function (f) { counts[f.level] = (counts[f.level] || 0) + 1; });

    // A blunt readiness signal, not a grade: errors block, warnings cost time.
    var verdict = counts.err ? 'blocked' : counts.warn >= 3 ? 'risky' : counts.warn ? 'minor' : 'ready';

    return {
      findings: findings,
      counts: counts,
      lines: nonEmpty.length,
      words: src.trim() ? src.trim().split(/\s+/).length : 0,
      verdict: verdict
    };
  }

  /* The deliverable a QA actually sends: a de-duplicated question list. */
  function questions(result) {
    var seen = {};
    var out = [];
    result.findings.forEach(function (f) {
      if (seen[f.id]) return;
      seen[f.id] = true;
      out.push({
        level: f.level,
        line: f.line,
        about: f.label + (f.match ? ' (' + f.match + ')' : ''),
        ask: f.ask,
        quote: f.text
      });
    });
    // errors first - those block testing
    var order = { err: 0, warn: 1, info: 2 };
    return out.sort(function (a, b) { return order[a.level] - order[b.level]; });
  }

  window.QAT.aclint = { lint: lint, questions: questions, RULES: RULES, DOC_RULES: DOC_RULES, VAGUE: VAGUE };
})();
