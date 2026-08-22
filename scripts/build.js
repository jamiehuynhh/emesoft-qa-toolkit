/* =============================================================================
   Assemble the deployable static bundle.  (npm run build)
   -----------------------------------------------------------------------------
   The same script runs locally and in CI, so what you test on your machine is
   byte-for-byte what gets published. It does three things:

     1. copies only what the browser needs
     2. refuses to finish if server code or a secret slipped in
     3. refuses to finish if the page references a file that is not there

   Check 3 is the one that has actually caught things. A missing stylesheet or
   font is a blank or unstyled page for every visitor, and the old inline CI
   check only looked at `src="..."` in index.html — which misses the favicon
   (an `href`), the fonts (inside `url()` in the CSS), and the two logo files
   (built in JS as 'assets/img/' + name, so the full path is never a literal).

   Usage:  node scripts/build.js [--out dist] [--quiet]
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* What ships. Everything else — server/, scripts/, .env, logs/ — stays home. */
export const INCLUDE_FILES = ['index.html', '_headers'];
export const INCLUDE_DIRS = ['assets', 'js'];

/* Must never reach a public host. */
export const FORBIDDEN = ['server', 'scripts', '.env', '.env.local', '.env.production', 'logs', 'node_modules'];

const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|mp4|webm)$/i;

/* ---------------------------------------------------------------- helpers */

function walk(dir, out) {
  out = out || [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const slash = (p) => p.split(path.sep).join('/');

export function copyInto(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const f of INCLUDE_FILES) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, f));
  }
  for (const d of INCLUDE_DIRS) {
    fs.cpSync(path.join(ROOT, d), path.join(dest, d), { recursive: true });
  }
  // GitHub Pages runs Jekyll otherwise, which drops files starting with "_".
  fs.writeFileSync(path.join(dest, '.nojekyll'), '');
}

/* ------------------------------------------------------- reference finding */

/**
 * Explicit relative paths the page asks the browser to fetch: src= and href=
 * in the HTML, and url(...) in every stylesheet. Each comes back already
 * resolved against the file that mentioned it, so a font written as
 * ../fonts/x.woff2 inside assets/css/app.css is returned as assets/fonts/x.woff2.
 *
 * @param {string} dir root of the assembled bundle
 * @returns {Array<{ref: string, from: string}>}
 */
export function explicitRefs(dir) {
  const found = [];
  const html = path.join(dir, 'index.html');

  if (fs.existsSync(html)) {
    const src = fs.readFileSync(html, 'utf8');
    const re = /\b(?:src|href)\s*=\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(src))) {
      const v = m[1];
      if (/^(?:[a-z]+:)?\/\//i.test(v) || v.startsWith('#') || v.startsWith('data:') || v.startsWith('mailto:')) continue;
      found.push({ ref: v.split(/[?#]/)[0], from: 'index.html' });
    }
  }

  for (const css of walk(dir).filter((f) => f.endsWith('.css'))) {
    const src = fs.readFileSync(css, 'utf8');
    const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      const v = m[2].trim();
      if (/^(?:[a-z]+:)?\/\//i.test(v) || v.startsWith('data:')) continue;
      // resolve against the stylesheet's own folder, the way a browser does
      const abs = path.resolve(path.dirname(css), v.split(/[?#]/)[0]);
      found.push({ ref: slash(path.relative(dir, abs)), from: slash(path.relative(dir, css)) });
    }
  }
  return found;
}

/**
 * Asset file names mentioned as string literals in the scripts. This catches
 * paths the code builds by concatenation, where no full path exists to grep
 * for — js/core.js picks the landing logo with 'assets/img/' + variant.
 * Matched on the file name alone, so renaming something in assets/ without a
 * matching edit in the script is reported instead of shipping a broken image.
 *
 * @param {string} dir root of the assembled bundle
 * @returns {Array<{name: string, from: string}>}
 */
export function scriptAssetNames(dir) {
  const found = [];
  const seen = new Set();
  for (const js of walk(dir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(js, 'utf8');
    const re = /['"]([A-Za-z0-9_.\-/]+\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|mp4|webm))['"]/g;
    let m;
    while ((m = re.exec(src))) {
      const name = m[1].split('/').pop();
      const from = slash(path.relative(dir, js));
      const key = name + '|' + from;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ name, from });
    }
  }
  return found;
}

/* ------------------------------------------------------------- the checks */

/**
 * @param {string} dir root of the assembled bundle
 * @returns {string[]} human-readable problems; empty means the bundle is sound
 */
export function verify(dir) {
  const problems = [];

  for (const name of FORBIDDEN) {
    if (fs.existsSync(path.join(dir, name))) problems.push(name + ' leaked into the bundle');
  }

  for (const { ref, from } of explicitRefs(dir)) {
    if (!fs.existsSync(path.join(dir, ref))) {
      problems.push(ref + ' is referenced by ' + from + ' but is not in the bundle');
    }
  }

  const present = new Set(walk(dir).filter((f) => ASSET_EXT.test(f)).map((f) => path.basename(f)));
  for (const { name, from } of scriptAssetNames(dir)) {
    if (!present.has(name)) {
      problems.push(name + ' is requested by ' + from + ' but no such file is in the bundle');
    }
  }

  return problems;
}

/* ------------------------------------------------------------------- main */

function main(argv) {
  const outArg = argv.indexOf('--out');
  const out = path.resolve(ROOT, outArg > -1 ? argv[outArg + 1] : 'dist');
  const quiet = argv.includes('--quiet');

  if (out === ROOT) {
    console.error('build: refusing to use the project root as the output folder');
    return 1;
  }

  copyInto(out);

  const problems = verify(out);
  if (problems.length) {
    console.error('build FAILED - ' + problems.length + ' problem(s):');
    for (const p of problems) {
      // GitHub Actions turns this prefix into an annotation on the run
      console.error(process.env.GITHUB_ACTIONS ? '::error::' + p : '  - ' + p);
    }
    return 1;
  }

  const files = walk(out);
  const bytes = files.reduce((n, f) => n + fs.statSync(f).size, 0);
  if (!quiet) {
    for (const f of files.map((f) => slash(path.relative(out, f))).sort()) console.log('  ' + f);
  }
  console.log('build OK - ' + files.length + ' files, ' + (bytes / 1024).toFixed(0) + ' KB -> ' +
    slash(path.relative(ROOT, out)) + '/');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
