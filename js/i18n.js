/* =============================================================================
   Static UI strings. Tool-level strings live inline via QAT.L(en, vi).
   ========================================================================== */
window.QAT_I18N = {
  en: {
    'brand.tagline': 'Smarter software testing',
    'search.side': 'Filter tools...',
    'search.global': 'Search tools (Ctrl+K)',
    'nav.home': 'Home',
    'nav.dashboard': 'All tools',
    'ai.settings': 'AI Settings',

    'landing.metaTag': '24 tools for QA/QC',
    'landing.nav.tools': 'Open the tools',
    'landing.nav.how': 'How it works',
    'landing.eyebrow': 'EmeSoft · Internal QA tooling',
    'landing.h1a': 'The everyday QA jobs,',
    'landing.h1b': 'in one place',
    'landing.sub': 'Format and inspect payloads, compare text, decode tokens, read a HAR, ' +
      'validate a customer import, generate Vietnamese test data, and lint acceptance criteria ' +
      'before you write a single test case. No account, no upload, no install.',
    'landing.ctaPrimary': 'Open the toolkit',
    'landing.ctaSecondary': 'How it works',
    'landing.heroNote': 'Runs in your browser. 20 of the 24 tools need no network at all.',
    'landing.toolsWord': 'tools',

    'landing.metric.offline': 'Work offline',
    'landing.metric.deps': 'Dependencies',

    'landing.why.kicker': 'Why it exists',
    'landing.why.title': 'Stop pasting internal data into random websites',
    'landing.why.body': 'A QA day involves a dozen small jobs, each usually done on a different ' +
      'free website — with production payloads, tokens and customer records pasted into pages ' +
      'nobody vetted. This puts those jobs in one internal page that processes everything locally.',

    'landing.f1.t': 'Nothing leaves the page',
    'landing.f1.b': 'JSON, diffs, JWTs, hashes, test data: all computed in your browser. ' +
      'No request goes out, so there is nothing to leak and nothing to log.',
    'landing.f2.t': 'Reads a HAR the way you would',
    'landing.f2.b': 'Drop a DevTools export and get the failures, the slow calls, the N+1 ' +
      'pattern, oversized payloads and credentials sitting in query strings.',
    'landing.f3.t': 'Catches bad requirements early',
    'landing.f3.b': 'The AC linter turns "should load fast" and "validated properly" into ' +
      'specific questions for the author — before anyone writes test cases from a guess.',
    'landing.f4.t': 'Vietnamese data, done properly',
    'landing.f4.b': 'Generate tax codes with real check digits and reproducible seeds, then ' +
      'validate a customer import and see exactly which rows are wrong and why.',

    'landing.how.kicker': 'How it works',
    'landing.how.title': 'A single page, and an optional server',
    'landing.how.body': 'The toolkit is plain HTML, CSS and JavaScript with no build step and ' +
      'no dependencies. Open it and it works. The bundled Node server is only needed if you ' +
      'want the AI tools to run in-page.',
    'landing.h1.t': 'Open and use',
    'landing.h1.b': 'every tool has its own URL, so you can bookmark and share the exact one.',
    'landing.h2.t': 'Bring your own AI, or none',
    'landing.h2.b': 'one line of config switches between a local model, a free tier, or nothing ' +
      'at all — "Copy prompt" hands you the finished prompt to paste anywhere.',
    'landing.h3.t': 'Sensitive data masked first',
    'landing.h3.b': 'emails, phone numbers, cards and tokens are stripped before any prompt ' +
      'leaves the page, and you see exactly what was masked.',
    'landing.h4.t': 'Tested, not hoped',
    'landing.h4.b': '309 assertions cover the hashing, CSV quoting, check digits and everything ' +
      'else that would fail quietly.',

    'landing.cats.kicker': 'What is inside',
    'landing.cats.title': 'Five categories, 24 tools',
    'landing.cat.text': 'Compare, count, convert case, clean up lines, test regex, lint AC.',
    'landing.cat.data': 'JSON, CSV, SQL, timestamps, Base64, URLs, Vietnamese data validation.',
    'landing.cat.security': 'JWT, hashes, API responses, HAR and network analysis.',
    'landing.cat.generator': 'Vietnamese test data, UUIDs, boundary and injection values.',
    'landing.cat.ai': 'Test cases, bug reports, log analysis, test reports.',

    'landing.final.title': 'Open it and try one tool',
    'landing.final.body': 'Every tool ships with sample data, so you can see what it does ' +
      'before you paste anything of your own.',
    'landing.foot': 'Internal QA tooling · processed in your browser',
    'foot.local': 'Runs locally in your browser. Nothing is uploaded to a server.',
    'foot.built': 'Internal QA utilities',
    'foot.privacy': 'Client-side only — your input never leaves this page (except AI tools you explicitly run).',
    'badge.local': 'LOCAL',

    'hero.title': 'AI QA Toolkit',
    'hero.sub': 'One place for the everyday QA jobs: format and inspect payloads, compare text, decode tokens, generate Vietnamese test data, and let AI draft test cases, bug reports and test summaries.',
    'hero.tools': 'Tools',
    'hero.ai': 'AI-assisted',
    'hero.groups': 'Categories',
    'hero.client': 'Client-side',

    'dash.sub': 'Pick a tool, or press Ctrl+K to search. Every tool has sample data.',
    'filter.all': 'All',
    'msg.copied': 'Copied to clipboard',
    'msg.nothing': 'Nothing to copy',
    'msg.downloaded': 'Downloaded',
    'msg.noTool': 'No tool matches your search.',
    'msg.noToolTitle': 'Nothing found',
    'msg.cleared': 'Cleared'
  },

  vi: {
    'brand.tagline': 'Kiểm thử thông minh hơn',
    'search.side': 'Lọc công cụ...',
    'search.global': 'Tìm công cụ (Ctrl+K)',
    'nav.home': 'Trang chủ',
    'nav.dashboard': 'Tất cả công cụ',
    'ai.settings': 'Cấu hình AI',

    'landing.metaTag': '24 công cụ cho QA/QC',
    'landing.nav.tools': 'Mở công cụ',
    'landing.nav.how': 'Cách hoạt động',
    'landing.eyebrow': 'EmeSoft · Công cụ QA nội bộ',
    'landing.h1a': 'Những việc QA làm mỗi ngày,',
    'landing.h1b': 'gom về một chỗ',
    'landing.sub': 'Định dạng và kiểm tra payload, so sánh văn bản, giải mã token, đọc file HAR, ' +
      'kiểm tra file import của khách, sinh test data tiếng Việt, và soi lỗi Acceptance Criteria ' +
      'trước khi viết test case đầu tiên. Không cần tài khoản, không upload, không cài đặt.',
    'landing.ctaPrimary': 'Mở toolkit',
    'landing.ctaSecondary': 'Cách hoạt động',
    'landing.heroNote': 'Chạy ngay trong trình duyệt. 20 trong 24 công cụ không cần mạng.',
    'landing.toolsWord': 'công cụ',

    'landing.metric.offline': 'Chạy offline',
    'landing.metric.deps': 'Dependency',

    'landing.why.kicker': 'Vì sao có toolkit này',
    'landing.why.title': 'Đừng dán dữ liệu nội bộ lên website lạ nữa',
    'landing.why.body': 'Một ngày của QA gồm cả chục việc nhỏ, mỗi việc thường làm trên một ' +
      'website miễn phí khác nhau — kèm theo payload thật, token và dữ liệu khách hàng dán lên ' +
      'những trang không ai kiểm tra. Toolkit này gom các việc đó về một trang nội bộ, xử lý cục bộ.',

    'landing.f1.t': 'Dữ liệu không rời khỏi trang',
    'landing.f1.b': 'JSON, diff, JWT, hash, test data — tất cả tính ngay trong trình duyệt. ' +
      'Không có request nào đi ra, nên không có gì để rò rỉ và không có gì bị ghi log.',
    'landing.f2.t': 'Đọc file HAR thay bạn',
    'landing.f2.b': 'Kéo file export từ DevTools vào là thấy ngay request lỗi, call chậm, ' +
      'mẫu N+1, payload quá lớn và credential nằm lộ trong query string.',
    'landing.f3.t': 'Bắt yêu cầu kém từ sớm',
    'landing.f3.b': 'AC linter biến "phải tải nhanh" và "kiểm tra chính xác" thành câu hỏi ' +
      'cụ thể gửi người viết — trước khi có ai viết test case dựa trên phỏng đoán.',
    'landing.f4.t': 'Dữ liệu Việt Nam làm cho đúng',
    'landing.f4.b': 'Sinh MST đúng check digit, tái lập được bằng seed; rồi kiểm tra file ' +
      'import của khách và biết chính xác dòng nào sai, sai vì sao.',

    'landing.how.kicker': 'Cách hoạt động',
    'landing.how.title': 'Một trang duy nhất, server là tùy chọn',
    'landing.how.body': 'Toolkit là HTML, CSS và JavaScript thuần, không build step, không ' +
      'dependency. Mở là chạy. Node server đi kèm chỉ cần khi bạn muốn các công cụ AI chạy ' +
      'trực tiếp trong trang.',
    'landing.h1.t': 'Mở là dùng',
    'landing.h1.b': 'mỗi công cụ có URL riêng, nên bookmark và gửi đúng công cụ đó cho đồng nghiệp.',
    'landing.h2.t': 'AI tùy bạn, hoặc không cần',
    'landing.h2.b': 'một dòng cấu hình để đổi giữa model chạy local, free tier, hoặc không dùng ' +
      'gì cả — nút "Copy prompt" đưa bạn prompt hoàn chỉnh để dán vào đâu cũng được.',
    'landing.h3.t': 'Che dữ liệu nhạy cảm trước',
    'landing.h3.b': 'email, số điện thoại, số thẻ và token bị che trước khi bất kỳ prompt nào ' +
      'rời khỏi trang, và bạn thấy rõ những gì đã bị che.',
    'landing.h4.t': 'Có test, không phải tin suông',
    'landing.h4.b': '309 assertion phủ phần hash, escape CSV, check digit và mọi thứ khác có ' +
      'thể sai một cách âm thầm.',

    'landing.cats.kicker': 'Bên trong có gì',
    'landing.cats.title': 'Năm nhóm, 24 công cụ',
    'landing.cat.text': 'So sánh, đếm, đổi kiểu chữ, xử lý dòng, thử regex, soi lỗi AC.',
    'landing.cat.data': 'JSON, CSV, SQL, timestamp, Base64, URL, kiểm tra dữ liệu Việt Nam.',
    'landing.cat.security': 'JWT, hash, API response, phân tích HAR và network.',
    'landing.cat.generator': 'Test data Việt Nam, UUID, giá trị biên và chuỗi tấn công.',
    'landing.cat.ai': 'Test case, bug report, phân tích log, test report.',

    'landing.final.title': 'Mở lên và thử một công cụ',
    'landing.final.body': 'Mỗi công cụ đều có dữ liệu mẫu sẵn, nên bạn xem được nó làm gì ' +
      'trước khi dán bất cứ thứ gì của mình vào.',
    'landing.foot': 'Công cụ QA nội bộ · xử lý trong trình duyệt của bạn',
    'foot.local': 'Chạy trực tiếp trên trình duyệt. Không gửi dữ liệu lên máy chủ.',
    'foot.built': 'Công cụ nội bộ cho QA',
    'foot.privacy': 'Xử lý hoàn toàn tại trình duyệt — dữ liệu bạn nhập không rời khỏi trang này (trừ các công cụ AI khi bạn chủ động chạy).',
    'badge.local': 'CỤC BỘ',

    'hero.title': 'AI QA Toolkit',
    'hero.sub': 'Tập trung các việc QA làm hằng ngày: định dạng và kiểm tra dữ liệu, so sánh văn bản, giải mã token, tạo test data tiếng Việt, và để AI soạn test case, bug report, test report.',
    'hero.tools': 'Công cụ',
    'hero.ai': 'Có AI hỗ trợ',
    'hero.groups': 'Nhóm',
    'hero.client': 'Tại trình duyệt',

    'dash.sub': 'Chọn một công cụ, hoặc bấm Ctrl+K để tìm. Công cụ nào cũng có dữ liệu mẫu.',
    'filter.all': 'Tất cả',
    'msg.copied': 'Đã copy',
    'msg.nothing': 'Không có gì để copy',
    'msg.downloaded': 'Đã tải',
    'msg.noTool': 'Không có công cụ nào khớp với từ khóa.',
    'msg.noToolTitle': 'Không tìm thấy',
    'msg.cleared': 'Đã xóa'
  }
};
