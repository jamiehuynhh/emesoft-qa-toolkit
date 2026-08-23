/* =============================================================================
   Markdown -> a small block tree.
   -----------------------------------------------------------------------------
   Deliberately narrow: it handles the constructs docs/DEMO-SCRIPT.md actually
   uses and nothing else. A general Markdown parser would be a dependency and a
   liability; this has one job and its input is a file in this repository.

   Two renderers consume the same tree — HTML and Word — so the document cannot
   come out different depending on which one you asked for.

   Blocks: {type:'h',level,runs} {type:'p',runs} {type:'ul',items:[runs]}
           {type:'table',header:[runs],rows:[[runs]]} {type:'pre',text}
           {type:'quote',runs} {type:'hr'}
   A "runs" value is an array of {t, b?, code?} — text with optional bold and
   inline-code flags.
   ========================================================================== */

/** Split inline markup into runs. Bold and code do not nest in this document. */
export function runs(s) {
  const out = [];
  // links: keep the label, drop the target — a printed runbook cannot be
  // clicked, and a bare relative path in the text is noise
  s = s.replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1');

  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ t: tok.slice(2, -2), b: true });
    else out.push({ t: tok.slice(1, -1), code: true });
    last = m.index + tok.length;
  }
  if (last < s.length) out.push({ t: s.slice(last) });
  return out.length ? out : [{ t: '' }];
}

/** Does this line open a new block, rather than continue the current one? */
const startsBlock = (l) => /^(#{1,4}\s|```|\||>|\s*[-*]\s|---+\s*$)/.test(l);

/** @param {string} md @returns {Array<object>} */
export function parse(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let list = null;

  const closeList = () => { if (list) { blocks.push(list); list = null; } };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      closeList();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ type: 'pre', text: body.join('\n') });
      continue;
    }

    if (/^\|/.test(line) && /^\|[\s:|-]+\|$/.test(lines[i + 1] || '')) {
      closeList();
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = cells(line).map(runs);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]).map(runs));
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); blocks.push({ type: 'h', level: h[1].length, runs: runs(h[2]) }); i++; continue; }

    if (/^---+$/.test(line.trim())) { closeList(); blocks.push({ type: 'hr' }); i++; continue; }

    if (/^>\s?/.test(line)) {
      closeList();
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', runs: runs(body.join(' ').trim()) });
      continue;
    }

    const li = line.match(/^\s*[-*]\s+(?:\[( |x)\]\s+)?(.*)$/);
    if (li) {
      // A wrapped item continues on the next line. Without absorbing it the item
      // is cut in two, the tail becomes a stray paragraph after the list, and any
      // **bold** spanning the break is split so neither half converts.
      const parts = [li[2]];
      i++;
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) parts.push(lines[i++].trim());
      const box = li[1] === undefined ? '' : (li[1] === 'x' ? '☒ ' : '☐ ');
      if (!list) list = { type: 'ul', items: [] };
      list.items.push(runs(box + parts.join(' ')));
      continue;
    }

    if (!line.trim()) { closeList(); i++; continue; }

    closeList();
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) para.push(lines[i++]);
    blocks.push({ type: 'p', runs: runs(para.join(' ')) });
  }
  closeList();
  return blocks;
}
