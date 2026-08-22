/* =============================================================================
   Pack the whole toolkit into one self-contained HTML file.
   (npm run build:single)
   -----------------------------------------------------------------------------
   Output: dist-single/qa-toolkit.html — one file, no folder next to it,
   nothing to fetch. Double-click it from a USB stick, mail it to a tester, or
   paste it into any host that only takes a single page. Every stylesheet, all
   33 scripts, three fonts and three logos are embedded.

   Deliberately not inside dist/: `npm run build` clears that folder, so a
   single file living there would disappear the next time the static site was
   assembled.

   This is a second output of the same source, not a fork: it reads the very
   files the normal build ships, in the order index.html declares them, so the
   two cannot drift.

   Why the logo needs special handling: js/core.js picks the landing logo with
       '<img src="assets/img/' + (dark ? 'emesoft-logo-white.png' : ...)
   so no full path exists in the source to swap. The prefix and the two file
   names are replaced separately, longest first, and base64 cannot contain
   '.' or '-' so an inserted data URI can never be re-matched by a later pass.

   Usage:  node scripts/bundle-single.js [--out dist-single/qa-toolkit.html]
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

/** @returns {string} a data: URI for a file on disk */
export function dataUri(abs) {
  const type = MIME[path.extname(abs).toLowerCase()];
  if (!type) throw new Error('no MIME type known for ' + abs);
  return 'data:' + type + ';base64,' + fs.readFileSync(abs).toString('base64');
}

/**
 * Replace every url(...) in a stylesheet with the embedded file, resolving each
 * path against the stylesheet's own folder the way a browser does.
 * @param {string} css
 * @param {string} cssPath absolute path of the stylesheet the CSS came from
 */
export function inlineCssUrls(css, cssPath) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, _q, ref) => {
    if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith('data:')) return whole;
    const abs = path.resolve(path.dirname(cssPath), ref.split(/[?#]/)[0]);
    if (!fs.existsSync(abs)) throw new Error('CSS references a missing file: ' + ref);
    return "url('" + dataUri(abs) + "')";
  });
}

/**
 * Embed the images the scripts ask for. Ordered longest-key-first so a full
 * path is consumed before the bare folder prefix, and the prefix before the
 * bare file names the ternary arms hold.
 * @param {string} js concatenated script text
 * @param {string} imgDir absolute path of the image folder
 */
export function inlineJsImages(js, imgDir) {
  const names = fs.readdirSync(imgDir).filter((n) => MIME[path.extname(n).toLowerCase()]);
  const uris = new Map(names.map((n) => [n, dataUri(path.join(imgDir, n))]));
  const rel = path.relative(path.join(ROOT), imgDir).split(path.sep).join('/') + '/';

  let out = js;
  for (const n of [...names].sort((a, b) => b.length - a.length)) out = out.split(rel + n).join(uris.get(n));
  out = out.split(rel).join('');                       // the concatenated prefix
  for (const n of [...names].sort((a, b) => b.length - a.length)) out = out.split(n).join(uris.get(n));
  return out;
}

/**
 * Make script text safe to sit inside a <script> element.
 *
 * The HTML parser closes an inline script at the first literal "</script" it
 * sees, without caring that it is inside a JavaScript string. The toolkit ships
 * exactly such a string: the random-string tool offers '<script>alert(1)</script>'
 * as an XSS probe. Left alone it truncates the bundle mid-file, everything
 * after it -- including boot.js -- is parsed as text, and the page is blank.
 *
 * "<\/script" is the same string to JavaScript, in a literal or a regex, and
 * is invisible to the HTML parser. "<!--" gets the same treatment because it
 * opens an HTML comment inside legacy script parsing.
 *
 * @param {string} js
 */
export function escapeForInlineScript(js) {
  return js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

/** The scripts and stylesheets index.html declares, in document order. */
export function declaredSources(html) {
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"><\/script>\s*/g)].map((m) => m[1]);
  const styles = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)">\s*/g)].map((m) => m[1]);
  return { scripts, styles };
}

/**
 * Attributes in the markup that still point at a separate file.
 *
 * Only the markup can: script and style bodies legitimately contain
 * attribute-looking text -- the markdown renderer builds '<a href="$2">', the
 * landing page writes '<img src="' before concatenating the logo it picked,
 * and a comment can mention a path. So both are blanked before the scan, and
 * the build and the test share this one definition rather than each guessing.
 *
 * @param {string} page
 * @returns {string[]}
 */
export function markupLeftovers(page) {
  const markup = page
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>');
  return [...new Set(markup.match(/(?:src|href)="(?!data:|#|https?:|mailto:)[^"]*"/g) || [])];
}

/**
 * Build the single-file page.
 *
 * The Artifact host supplies <!doctype>, <html>, <head> and <body>, so those
 * wrappers are stripped and the page content is emitted on its own. A browser
 * opening the file directly infers all four, so the same output works from
 * file:// as well.
 *
 * @returns {string} the complete page
 */
export function buildSingleFile() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const { scripts, styles } = declaredSources(html);
  if (!scripts.length) throw new Error('index.html declares no scripts — the regex stopped matching');
  if (!styles.length) throw new Error('index.html declares no stylesheet — the regex stopped matching');

  let out = html;

  // Every replacement below passes a function rather than a string. A string
  // replacement would reinterpret $&, $1, $' and friends inside the code being
  // inserted, and the toolkit's own markdown renderer contains '<a href="$2">'.
  const literal = (s) => () => s;
  const rx = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  // ---- stylesheets, fonts embedded ------------------------------------
  for (const href of styles) {
    const abs = path.join(ROOT, href);
    const css = inlineCssUrls(fs.readFileSync(abs, 'utf8'), abs);
    out = out.replace(rx('<link rel="stylesheet" href="' + href + '">'),
      literal('<style>\n' + css + '\n</style>'));
  }

  // ---- scripts, in the order the page declares them --------------------
  const parts = scripts.map((src) => {
    const abs = path.join(ROOT, src);
    if (!fs.existsSync(abs)) throw new Error('index.html loads a missing script: ' + src);
    return '/* ---- ' + src + ' ---- */\n' + fs.readFileSync(abs, 'utf8');
  });

  // Last, so QAT already exists: re-point QAT.download at the artifact
  // runtime's save() when the page is running inside the claude.ai viewer,
  // where clicking an <a download> does nothing. Inert everywhere else.
  const adapter = path.join(ROOT, 'scripts/artifact-adapter.js');
  if (!fs.existsSync(adapter)) throw new Error('missing ' + path.relative(ROOT, adapter));
  parts.push('/* ---- scripts/artifact-adapter.js ---- */\n' + fs.readFileSync(adapter, 'utf8'));

  const code = parts.join('\n');

  // Drop the individual tags, then put one script where the last one was.
  for (const src of scripts) {
    out = out.replace(rx('<script src="' + src + '"></script>'), literal(''));
  }
  const inlined = '<script>\n' +
    escapeForInlineScript(inlineJsImages(code, path.join(ROOT, 'assets/img'))) + '\n</script>\n';
  out = out.replace(/<\/body>/, literal(inlined + '</body>'));

  // ---- images in the markup -------------------------------------------
  out = inlineJsImages(out, path.join(ROOT, 'assets/img'));

  // ---- shed the wrappers the host provides ----------------------------
  // The favicon goes with them: an Artifact takes its tab icon from the
  // publish call, and a file:// page simply has none.
  out = out.replace(/<link rel="icon"[^>]*>\s*/g, '');
  const head = out.match(/<head>([\s\S]*?)<\/head>/);
  const body = out.match(/<body>([\s\S]*?)<\/body>/);
  if (!head || !body) throw new Error('index.html no longer has a <head> and <body> to unwrap');

  const keep = head[1]
    .split('\n')
    .filter((l) => !/<meta charset|<meta name="viewport"/.test(l))   // the host sets both
    .join('\n')
    // index.html's title carries a summary after an em dash, which earns its
    // keep in a search result. A single file is never indexed -- it is a tab
    // label and a file name -- so it keeps the name and drops the summary. The
    // full sentence is already the meta description right below it.
    .replace(/<title>([^<—]+)—[^<]*<\/title>/, (_m, name) => '<title>' + name.trim() + '</title>')
    .trim();

  return keep + '\n' + body[1].trim() + '\n';
}

/* ------------------------------------------------------------------- main */

function main(argv) {
  const outArg = argv.indexOf('--out');
  const out = path.resolve(ROOT, outArg > -1 ? argv[outArg + 1] : 'dist-single/qa-toolkit.html');

  const page = buildSingleFile();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page, 'utf8');

  const leftover = markupLeftovers(page);
  if (leftover.length) {
    console.error('single-file build FAILED - the markup still points at separate files:');
    for (const l of [...new Set(leftover)]) console.error('  - ' + l);
    return 1;
  }

  // Only a closing tag can truncate an inline script -- "<script" sitting in a
  // string or a comment is invisible to the HTML parser, and the toolkit has
  // both. So this counts closing tags only, and insists the one that exists is
  // the last thing in the file. More than one, or one that lands early, means
  // a "</script" got past escapeForInlineScript() and the rest of the bundle
  // would be parsed as text: a blank page.
  const closes = [...page.matchAll(/<\/script\b/gi)].map((m) => m.index);
  if (closes.length !== 1) {
    console.error('single-file build FAILED - found ' + closes.length + ' </script> tags, ' +
      'expected 1. A "</script" in the code closed the block early, so everything ' +
      'after it would not run.');
    return 1;
  }
  if (page.length - closes[0] > 40) {
    console.error('single-file build FAILED - the script closes ' + (page.length - closes[0]) +
      ' bytes before the end of the file, so that much code would not run.');
    return 1;
  }

  console.log('single-file build OK - ' + (page.length / 1024).toFixed(0) + ' KB -> ' +
    path.relative(ROOT, out).split(path.sep).join('/'));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
