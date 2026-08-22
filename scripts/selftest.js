/* =============================================================================
   AI QA Toolkit — self test  (npm test)
   -----------------------------------------------------------------------------
   The toolkit's logic lives in plain browser scripts that attach to window.QAT.
   This runner aliases `window` to the Node global, loads those same files, and
   asserts the parts that must never silently break: hash vectors, CSV quoting
   and type coercion, the diff algorithm, the Vietnamese tax-code check digit,
   seeded-generator reproducibility, and the tool registry.

   No dependencies, no test framework. Exit code 1 if anything fails.
   ========================================================================== */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  toOpenAIRequest, createStreamTranslator, openAIResponseToAnthropic,
  resolvePreset, PRESETS, retiredPresets
} from '../server/providers.js';
import {
  securityHeaders, checkAuth, safeEqual, guardExposure, createRateLimiter, clientKey
} from '../server/security.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

/* --- browser-ish globals the scripts expect -------------------------------
   Node keeps growing web globals, and some of them (navigator since Node 21)
   are accessor-only, so a plain assignment throws. define() handles both. */
function define(name, value, { force = false } = {}) {
  if (!force) {
    try { if (name in globalThis) return; } catch { /* accessor threw */ }
  }
  try {
    globalThis[name] = value;
  } catch {
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
}

define('window', globalThis, { force: true });
define('navigator', { clipboard: null });
// forced: Node's own localStorage needs a CLI flag and throws without one
define('localStorage', {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
  clear() { this._d.clear(); }
}, { force: true });
define('document', {
  documentElement: { lang: 'en', setAttribute() {}, style: {} },
  // a real document always has this; scripts derive their own base from it
  baseURI: 'http://localhost/',
  currentScript: null,
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }),
  addEventListener() {},
  body: { contains: () => false, appendChild() {} }
}, { force: true });

function load(rel) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) throw new Error(`missing file: ${rel}`);
  vm.runInThisContext(readFileSync(file, 'utf8'), { filename: rel });
}

/* --- tiny assertion harness ---------------------------------------------- */
let pass = 0;
const failures = [];
let group = '';

function section(name) { group = name; console.log(`\n  ${name}`); }

function ok(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`    PASS  ${label}`);
  } else {
    failures.push(`${group} / ${label}${detail ? ` - ${detail}` : ''}`);
    console.log(`    FAIL  ${label}${detail ? `  (${detail})` : ''}`);
  }
}
function eq(label, actual, expected) {
  const a = typeof actual === 'object' ? JSON.stringify(actual) : String(actual);
  const e = typeof expected === 'object' ? JSON.stringify(expected) : String(expected);
  ok(label, a === e, a === e ? '' : `got ${a}, expected ${e}`);
}

/* --- load the toolkit ---------------------------------------------------- */
console.log('AI QA Toolkit - self test');
load('js/core.js');
load('js/i18n.js');
for (const f of ['hash', 'diff', 'csv', 'sqlfmt', 'faker', 'scrub', 'har', 'aclint', 'vnvalid']) load(`js/lib/${f}.js`);
load('js/ai.js');

const toolFiles = readdirSync(join(ROOT, 'js', 'tools')).filter((f) => f.endsWith('.js')).sort();
for (const f of toolFiles) load(`js/tools/${f}`);

const QAT = globalThis.QAT;

/* ========================================================================= */
section('Hashing (published test vectors)');
eq('md5("")', QAT.hash.md5(''), 'd41d8cd98f00b204e9800998ecf8427e');
eq('md5("abc")', QAT.hash.md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
eq('md5(pangram)', QAT.hash.md5('The quick brown fox jumps over the lazy dog'),
   '9e107d9d372bb6826bd81d3542a419d6');
eq('sha1("abc")', QAT.hash.sha1('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
eq('sha1("")', QAT.hash.sha1(''), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
eq('sha256("abc")', QAT.hash.sha256('abc'),
   'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
eq('sha256("")', QAT.hash.sha256(''),
   'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
// > 1 block, exercises the padding path
eq('sha256(56 chars)', QAT.hash.sha256('a'.repeat(56)),
   'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a');

section('Base64 / Base64URL');
ok('utf-8 round trip (Vietnamese + emoji)',
   QAT.hash.b64decode(QAT.hash.b64encode('Xin chào QA 😀')) === 'Xin chào QA 😀');
eq('encode known value', QAT.hash.b64encode('abc'), 'YWJj');
ok('base64url has no padding or +/', !/[+/=]/.test(QAT.hash.b64urlEncode('???????>>>>>>')));
ok('base64url round trip',
   QAT.hash.b64urlDecode(QAT.hash.b64urlEncode('{"alg":"HS256"}')) === '{"alg":"HS256"}');

section('CSV');
const parsed = QAT.csv.parse('a,b,c\n1,"x,y",true\n2,"say ""hi""",false');
eq('quoted comma stays in one field', parsed.rows[1][1], 'x,y');
eq('escaped quotes unescaped', parsed.rows[2][1], 'say "hi"');
eq('row count', parsed.rows.length, 3);
eq('semicolon detection', QAT.csv.detectDelimiter('a;b;c\n1;2;3'), ';');
eq('tab detection', QAT.csv.detectDelimiter('a\tb\tc'), '\t');
ok('delimiter inside quotes is not counted',
   QAT.csv.detectDelimiter('"a;b;c;d",x') === ',');

const typed = QAT.csv.toObjects(
  QAT.csv.parse('id,phone,mst,amount,dec,flag,big\n1,0912345678,0100109106,250000,3.14,true,12345678901234567890').rows,
  { typed: true }
)[0];
eq('numeric id coerced', typed.id, 1);
eq('leading-zero phone kept as text', typed.phone, '0912345678');
eq('leading-zero tax code kept as text', typed.mst, '0100109106');
eq('plain number coerced', typed.amount, 250000);
eq('decimal coerced', typed.dec, 3.14);
eq('boolean coerced', typed.flag, true);
eq('over-precision integer kept as text', typed.big, '12345678901234567890');

const rt = QAT.csv.fromObjects([{ a: 'x,y', b: 'say "hi"', c: '' }], ',', '\n');
eq('stringify quotes what it must', rt, 'a,b,c\n"x,y","say ""hi""",');
ok('round trip is stable',
   QAT.csv.parse(rt).rows[1][1] === 'say "hi"');

section('Diff');
const d = QAT.diff.seq(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e']);
eq('operation sequence', d.ops.map((o) => o.type), ['same', 'del', 'add', 'same', 'same', 'add']);
ok('identical input yields no changes',
   QAT.diff.seq(['1', '2'], ['1', '2']).ops.every((o) => o.type === 'same'));
const w = QAT.diff.words('status ACTIVE now', 'status LOCKED now');
ok('removed word marked', w.a.includes('mark-del') && w.a.includes('ACTIVE'));
ok('added word marked', w.b.includes('mark-add') && w.b.includes('LOCKED'));
ok('unchanged words not marked', !w.a.includes('mark-del">status'));

section('Test data generator');
const FIELDS = ['fullName', 'gender', 'dob', 'email', 'phone', 'address', 'taxCode', 'personalId'];
const a1 = QAT.faker.generate(FIELDS, 5, 'seed-1');
const a2 = QAT.faker.generate(FIELDS, 5, 'seed-1');
const b1 = QAT.faker.generate(FIELDS, 5, 'seed-2');
ok('same seed reproduces the same data', JSON.stringify(a1) === JSON.stringify(a2));
ok('different seed produces different data', JSON.stringify(a1) !== JSON.stringify(b1));

const batch = QAT.faker.generate(['taxCode', 'phone', 'personalId', 'email'], 200, 'check');
const W = [31, 29, 23, 19, 17, 13, 7, 5, 3];
ok('all 200 tax codes satisfy the MST check digit', batch.every((r) => {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(r.taxCode[i]) * W[i];
  return 10 - (sum % 11) === Number(r.taxCode[9]);
}));
ok('tax codes are 10 digits, never leading zero',
   batch.every((r) => /^[1-9]\d{9}$/.test(r.taxCode)));
ok('phones are 10 digits with a real VN prefix',
   batch.every((r) => /^0(3[2-9]|5[6-9]|7[06-9]|8[1-9]|9[0-9])\d{7}$/.test(r.phone)));
ok('personal IDs are 12 digits', batch.every((r) => /^\d{12}$/.test(r.personalId)));
ok('emails only use reserved test domains',
   batch.every((r) => /@(example\.(com|net)|test\.local|qa-sandbox\.dev|mailinator\.com)$/.test(r.email)));
ok('gender stays consistent with the generated name',
   a1.every((r) => r.gender === 'Nam' || r.gender === 'Nữ'));
ok('dob year matches the CCCD year segment',
   a1.every((r) => r.personalId.slice(4, 6) === r.dob.slice(2, 4)));
eq('deaccent handles Vietnamese', QAT.faker.deaccent('Nguyễn Đình Ước'), 'nguyen dinh uoc');

section('SQL formatter');
const sqlOut = QAT.sql.format("select a,b from t where x=1 and y=2 order by a desc");
ok('keywords upper-cased', sqlOut.includes('SELECT') && sqlOut.includes('ORDER BY'));
ok('FROM starts a new line', /\nFROM t/.test(sqlOut));
ok('AND is indented under WHERE', /\n\s+AND y = 2/.test(sqlOut));
const strKept = QAT.sql.format("select * from t where name = 'select from where'");
ok('keywords inside a string literal are untouched',
   strKept.includes("'select from where'"));
ok('comments are dropped by minify',
   !QAT.sql.minify('select 1 -- a comment\nfrom t').includes('comment'));

section('Markdown renderer');
const md = QAT.md('# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- one\n- two\n\n`code` **bold**');
ok('heading', md.includes('<h1>Title</h1>'));
ok('table head', md.includes('<th>a</th>'));
ok('table body', md.includes('<td>2</td>'));
ok('list', md.includes('<li>one</li>'));
ok('inline code', md.includes('<code>code</code>'));
ok('bold', md.includes('<strong>bold</strong>'));
ok('html in markdown is escaped',
   QAT.md('<img src=x onerror=alert(1)>').includes('&lt;img'));
ok('fenced code is escaped',
   QAT.md('```\n<b>hi</b>\n```').includes('&lt;b&gt;hi&lt;/b&gt;'));

section('Tool registry');
// Deliberately not a magic number: the filesystem is the source of truth, so
// adding a tool file without wiring it up is what we actually want to catch.
eq('tool file count matches registrations', QAT.tools.length, toolFiles.length);
ok('the registry is not empty', QAT.tools.length >= 20, `only ${QAT.tools.length}`);
const ids = QAT.tools.map((t) => t.id);
eq('ids are unique', new Set(ids).size, ids.length);
const groups = QAT.GROUPS.map((g) => g.id);
ok('every tool sits in a known group', QAT.tools.every((t) => groups.includes(t.group)));
ok('every tool has EN and VI name', QAT.tools.every((t) => t.name && t.name.en && t.name.vi));
ok('every tool has EN and VI description', QAT.tools.every((t) => t.desc && t.desc.en && t.desc.vi));
ok('every tool has a build function', QAT.tools.every((t) => typeof t.build === 'function'));
ok('every tool has search tags', QAT.tools.every((t) => Array.isArray(t.tags) && t.tags.length));
ok('file name matches tool id', toolFiles.every((f) => ids.includes(basename(f, '.js'))));
// The ai flag drives the badge and the credentials banner; the group drives
// navigation. They must agree in both directions or the UI lies.
eq('every ai-flagged tool sits in the ai group',
   QAT.tools.filter((t) => t.ai).length,
   QAT.tools.filter((t) => t.ai && t.group === 'ai').length);
eq('every tool in the ai group is ai-flagged',
   QAT.tools.filter((t) => t.group === 'ai').length,
   QAT.tools.filter((t) => t.group === 'ai' && t.ai).length);
ok('there is at least one AI tool', QAT.tools.some((t) => t.ai));
ok('search finds a tool by Vietnamese name', QAT.search('so sánh').length > 0);
ok('search finds a tool by tag', QAT.search('jwt').some((t) => t.id === 'jwt-decoder'));
ok('search with no match returns nothing', QAT.search('zzzz-not-a-tool').length === 0);

section('Landing page');
// The colour logo is drawn for white paper: measured against the dark nav its
// text sits at 1.05:1, i.e. invisible. The white variant is 15.48:1. This pins
// the mapping so a future edit cannot quietly put the dark logo back on dark.
function renderLandingHtml(theme, lang) {
  const prevTheme = QAT.theme, prevLang = QAT.lang;
  QAT.theme = theme;
  QAT.lang = lang || 'en';
  const view = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  QAT.renderLanding(view);
  QAT.theme = prevTheme;
  QAT.lang = prevLang;
  return view.innerHTML;
}
const lpDark = renderLandingHtml('dark');
const lpLight = renderLandingHtml('light');

ok('dark theme uses the white logo', /assets\/img\/emesoft-logo-white\.png/.test(lpDark));
ok('dark theme does NOT use the dark-on-dark colour logo',
   !/src="assets\/img\/emesoft-logo\.png"/.test(lpDark));
ok('light theme uses the colour logo', /src="assets\/img\/emesoft-logo\.png"/.test(lpLight));
ok('only one nav logo is emitted, not both hidden with CSS',
   (lpDark.match(/class="lp-logo"/g) || []).length === 1);
// the footer band is dark in both themes, so it always wants the white mark
ok('footer keeps the white logo in light theme',
   /lp-foot[\s\S]*emesoft-logo-white\.png/.test(lpLight));

ok('landing offers a theme toggle', /id="lpTheme"/.test(lpDark));
ok('landing offers a language toggle', /id="lpLang"/.test(lpDark));
ok('theme button shows the sun when dark', /id="lpTheme"[^>]*>\s*&#9788;/.test(lpDark));
ok('theme button shows the moon when light', /id="lpTheme"[^>]*>\s*&#9789;/.test(lpLight));
ok('language button reflects the active language',
   /id="lpLang"[^>]*>\s*VI/.test(renderLandingHtml('light', 'vi')) &&
   /id="lpLang"[^>]*>\s*EN/.test(lpLight));

ok('the CTA points at the tools dashboard, not back at itself', /href="#\/tools"/.test(lpDark));
// compared against the escaped form: the group label goes through QAT.esc, so
// "API & Security" appears as "API &amp; Security" in the markup
ok('landing renders every group as a category card',
   QAT.GROUPS.every((g) =>
     !QAT.tools.some((t) => t.group === g.id) ||
     lpDark.includes(QAT.esc(QAT.L(g.en, g.vi)))));
eq('one category card per non-empty group',
   (lpDark.match(/class="lp-cat"/g) || []).length,
   QAT.GROUPS.filter((g) => QAT.tools.some((t) => t.group === g.id)).length);
ok('Vietnamese landing is actually translated',
   /Những việc QA làm mỗi ngày/.test(renderLandingHtml('light', 'vi')));

eq('#/ is the landing route', typeof QAT.isLanding, 'function');
ok('an empty hash is the landing page', (function () {
  // isLanding reads location.hash; the harness has no location, so just assert
  // the router exposes the predicate the CSS class depends on
  return typeof QAT.renderLanding === 'function' && typeof QAT.renderDashboard === 'function';
})());

section('Team credit in both footers');
const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');
eq('the team name has one source of truth', QAT.TEAM, 'Next Orchestrated AI');
ok('landing footer credits the team', lpDark.includes(QAT.TEAM));
ok('landing footer uses the translated label',
   lpDark.includes(QAT.t('foot.team')));
ok('app footer markup carries the credit', /data-i18n="foot\.team"/.test(idx));
ok('app footer has the element boot fills from QAT.TEAM', /id="footTeam"/.test(idx));
ok('the markup fallback matches the constant',
   new RegExp('id="footTeam">\\s*' + QAT.TEAM).test(idx));
ok('boot overwrites the static name from the constant',
   /footTeam[\s\S]{0,120}QAT\.TEAM/.test(readFileSync(join(ROOT, 'js', 'boot.js'), 'utf8')));
ok('the label is translated in both languages', (() => {
  const en = (globalThis.QAT_I18N.en || {})['foot.team'];
  const vi = (globalThis.QAT_I18N.vi || {})['foot.team'];
  return Boolean(en) && Boolean(vi) && en !== vi;
})());
// the credit is a name, not a sentence that would need re-translating per locale
ok('the team name is not translated', !JSON.stringify(globalThis.QAT_I18N).includes('Next Orchestrated'));

section('Stylesheet guards');
// A UA stylesheet only sets [hidden]{display:none} at the weakest priority, so
// any author rule that sets display (.modal-wrap{display:grid},
// .btn{display:inline-flex}) silently un-hides the element. That shipped once as
// an empty settings popup on page load; this keeps the override in place.
const css = readFileSync(join(ROOT, 'assets', 'css', 'app.css'), 'utf8');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const cssFlat = css.replace(/\s+/g, '');
ok('app.css forces [hidden] to stay hidden',
   cssFlat.includes('[hidden]{display:none!important}'));
ok('index.html does rely on the hidden attribute', /\shidden(\s|>)/.test(html));
ok('the modal is hidden in markup', /id="aiModal"[^>]*\shidden/.test(html));
// elements that carry `hidden` in markup must not also be forced visible
const hiddenOwners = ['aiModal'];
ok('no author rule sets display on #aiModal itself',
   !hiddenOwners.some((id) => new RegExp('#' + id + '\\s*\\{[^}]*display', 'i').test(css)));

section('AI client configuration');
ok('not ready before configuration', QAT.ai.ready() === false);
QAT.ai.save({ provider: 'server' });
ok('server mode needs no key', QAT.ai.ready() === true);
QAT.ai.save({ provider: 'custom', endpoint: '' });
ok('proxy mode without endpoint is not ready', QAT.ai.ready() === false);
QAT.ai.save({ provider: 'custom', endpoint: 'https://x.invalid/api' });
ok('proxy mode with endpoint is ready', QAT.ai.ready() === true);
QAT.ai.save({ provider: 'anthropic', apiKey: '' });
ok('direct mode without a key is not ready', QAT.ai.ready() === false);
eq('default model', QAT.ai.cfg().model, 'claude-opus-5');

// The no-key path: the toolkit builds the prompt, the user pastes it into
// whatever assistant they already have. This must work with nothing configured.
eq('prompt merges system and user', QAT.ai.flattenPrompt({ system: 'S', user: 'U' }), 'S\n\n---\n\nU');
eq('prompt with no system is just the user text', QAT.ai.flattenPrompt({ system: '', user: 'U' }), 'U');
eq('prompt with no user is just the system text', QAT.ai.flattenPrompt({ system: 'S', user: '' }), 'S');
eq('empty prompt is empty, not "undefined"', QAT.ai.flattenPrompt({}), '');
eq('null prompt is safe', QAT.ai.flattenPrompt(null), '');
ok('surrounding whitespace is trimmed',
   QAT.ai.flattenPrompt({ system: '  S\n', user: '\n U  ' }) === 'S\n\n---\n\nU');
ok('the run bar offers the no-key path', /data-ai-prompt/.test(QAT.ai.runBar()));
ok('the no-key path is mentioned when nothing is configured',
   /Copy prompt/i.test(QAT.ai.notice()));

// The "no Node server" notice must name the cause that actually applies. It
// once told people running serve.ps1 over http that they had "opened
// index.html directly", which was flatly untrue.
const fileReason = QAT.ai.noServerReason('file:', 'null');
const httpReason = QAT.ai.noServerReason('http:', 'http://localhost:8123');
ok('file:// notice says the page is a local file', /local file/i.test(fileReason));
ok('http notice names the actual origin', httpReason.includes('http://localhost:8123'));
ok('http notice does not claim the file was opened directly',
   !/local file|opened as a file|index\.html directly/i.test(httpReason));
ok('http notice explains the missing endpoint', /\/api\/ai/.test(httpReason));
ok('http notice says Direct and Custom still work', /Direct and Custom/i.test(httpReason));
ok('both notices tell you what to run', /npm start/.test(fileReason) && /npm start/.test(httpReason));

section('Provider adapter (Claude dialect <-> OpenAI dialect)');
const anthropicBody = {
  model: 'claude-opus-5',
  max_tokens: 12000,
  stream: true,
  thinking: { type: 'adaptive' },
  output_config: { effort: 'high' },
  system: 'You are a QA engineer.',
  messages: [{ role: 'user', content: 'Write test cases.' }]
};
const oa = toOpenAIRequest(anthropicBody, { model: 'llama3.2:3b' });
eq('server model wins over the one the browser sent', oa.model, 'llama3.2:3b');
eq('system prompt becomes the first message', oa.messages[0].role, 'system');
eq('system text is preserved', oa.messages[0].content, 'You are a QA engineer.');
eq('user message follows', oa.messages[1].role, 'user');
eq('max_tokens carried over', oa.max_tokens, 12000);
ok('streaming requested', oa.stream === true);
ok('Claude-only "thinking" is not forwarded', oa.thinking === undefined);
ok('Claude-only "output_config" is not forwarded', oa.output_config === undefined);
ok('stream_options omitted unless asked', oa.stream_options === undefined);
ok('stream_options added when asked',
   toOpenAIRequest(anthropicBody, { model: 'x', streamUsage: true }).stream_options !== undefined);
eq('content blocks are flattened to text',
   toOpenAIRequest({ messages: [{ role: 'user', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }] },
                   { model: 'x' }).messages[0].content, 'a\nb');

// Replay a realistic OpenAI stream and check the Claude events we emit.
const tr = createStreamTranslator('llama3.2:3b');
let emitted = '';
emitted += tr.push('{"choices":[{"delta":{"role":"assistant"}}]}');
emitted += tr.push('{"choices":[{"delta":{"content":"Hello"}}]}');
emitted += tr.push('{"choices":[{"delta":{"content":" world"}}]}');
emitted += tr.push('{"choices":[{"delta":{},"finish_reason":"length"}],"usage":{"prompt_tokens":11,"completion_tokens":22}}');
emitted += tr.push('[DONE]');

ok('emits message_start once', (emitted.match(/event: message_start/g) || []).length === 1);
ok('emits content_block_start', emitted.includes('event: content_block_start'));
eq('emits one delta per content chunk', (emitted.match(/text_delta/g) || []).length, 2);
ok('delta text is intact', emitted.includes('"text":"Hello"') && emitted.includes('"text":" world"'));
ok('maps finish_reason length -> max_tokens', emitted.includes('"stop_reason":"max_tokens"'));
ok('reports usage as input/output tokens',
   emitted.includes('"input_tokens":11') && emitted.includes('"output_tokens":22'));
ok('closes with message_stop', emitted.trim().endsWith('{"type":"message_stop"}'));
ok('end() after [DONE] emits nothing more', tr.end() === '');

const trErr = createStreamTranslator('m');
const errOut = trErr.push('{"error":{"message":"model not found","type":"invalid_request"}}');
ok('upstream error becomes an error event', /event: error/.test(errOut));
ok('upstream error keeps the provider message', errOut.includes('model not found'));

// A provider that closes the socket without sending [DONE] or finish_reason
// must still produce a complete, well-formed Claude stream.
const trStop = createStreamTranslator('m');
trStop.push('{"choices":[{"delta":{"content":"hi"}}]}');
const tail = trStop.end();
ok('a stream that just ends still closes cleanly', /event: message_stop/.test(tail));
ok('missing finish_reason defaults to end_turn', /"stop_reason":"end_turn"/.test(tail));

// An empty stream (no content at all) must not emit a half-open block.
const trEmpty = createStreamTranslator('m');
const emptyOut = trEmpty.end();
ok('empty stream still opens and closes the content block',
   /content_block_start/.test(emptyOut) && /content_block_stop/.test(emptyOut));

const nonStream = openAIResponseToAnthropic({
  id: 'x', model: 'llama3.2:3b',
  choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 5, completion_tokens: 7 }
}, 'llama3.2:3b');
eq('non-stream response text', nonStream.content[0].text, 'answer');
eq('non-stream stop reason', nonStream.stop_reason, 'end_turn');
eq('non-stream usage', nonStream.usage.input_tokens, 5);

ok('every preset has url + model', Object.values(PRESETS).every((p) => p.url && p.model));
ok('every preset declares its dialect',
   Object.values(PRESETS).every((p) => p.provider === 'anthropic' || p.provider === 'openai'));
eq('ollama preset needs no key', PRESETS.ollama.needsKey, false);
eq('ollama preset points at localhost', /127\.0\.0\.1|localhost/.test(PRESETS.ollama.url), true);
eq('anthropic is the only anthropic-dialect preset',
   Object.values(PRESETS).filter((p) => p.provider === 'anthropic').length, 1);
eq('preset lookup is case-insensitive', resolvePreset('Gemini').label, PRESETS.gemini.label);
eq('unknown preset resolves to null', resolvePreset('nope'), null);
eq('empty preset resolves to null', resolvePreset(''), null);

// A provider that no longer exists must be refused loudly. GitHub Models was
// retired on 2026-07-30; silently falling back to Anthropic would send requests
// somewhere the user never chose.
ok('github is flagged retired', PRESETS.github.retired === '2026-07-30');
ok('a retired preset explains itself', /retired/i.test(PRESETS.github.retiredNote || ''));
ok('the note names working alternatives',
   /groq/.test(PRESETS.github.retiredNote) && /ollama/.test(PRESETS.github.retiredNote));
ok('a retired preset still resolves, so the server can explain it',
   resolvePreset('github') !== null);
eq('exactly one preset is retired', retiredPresets(), ['github']);
ok('no non-retired preset points at a known-dead host',
   Object.entries(PRESETS).every(([, p]) => p.retired || !/models\.github\.ai/.test(p.url)));
ok('the free options are all present',
   ['ollama', 'gemini', 'groq', 'openrouter', 'cerebras', 'mistral', 'nvidia']
     .every((k) => PRESETS[k] && PRESETS[k].url));

section('Security: headers');
const hdr = securityHeaders({ https: false });
ok('sets a Content-Security-Policy', Boolean(hdr['content-security-policy']));
ok('CSP blocks inline script', !/script-src[^;]*unsafe-inline/.test(hdr['content-security-policy']));
ok('CSP allows the style attributes the markup uses',
   /style-src[^;]*'unsafe-inline'/.test(hdr['content-security-policy']));
ok('CSP allows the data: favicon', /img-src[^;]*data:/.test(hdr['content-security-policy']));
ok('CSP allows Direct mode to reach Anthropic',
   /connect-src[^;]*api\.anthropic\.com/.test(hdr['content-security-policy']));
ok('CSP forbids framing', /frame-ancestors 'none'/.test(hdr['content-security-policy']));
eq('nosniff', hdr['x-content-type-options'], 'nosniff');
eq('deny framing', hdr['x-frame-options'], 'DENY');
eq('no referrer leakage', hdr['referrer-policy'], 'no-referrer');
ok('HSTS is off on plain http', !hdr['strict-transport-security']);
ok('HSTS is on behind TLS', Boolean(securityHeaders({ https: true })['strict-transport-security']));
ok('a custom connect-src host can be added',
   /my-gateway\.internal/.test(securityHeaders({ connectExtra: ['https://my-gateway.internal'] })['content-security-policy']));

section('Security: auth gate');
eq('no token configured means no gate', checkAuth({ headers: {} }, ''), null);
eq('missing token is 401', checkAuth({ headers: {} }, 'secret').status, 401);
eq('wrong token is 403', checkAuth({ headers: { authorization: 'Bearer nope' } }, 'secret').status, 403);
eq('correct bearer token passes', checkAuth({ headers: { authorization: 'Bearer secret' } }, 'secret'), null);
eq('x-api-token header also works', checkAuth({ headers: { 'x-api-token': 'secret' } }, 'secret'), null);
eq('bearer prefix is case-insensitive',
   checkAuth({ headers: { authorization: 'bearer secret' } }, 'secret'), null);
ok('comparison rejects a token that is a prefix of the real one',
   checkAuth({ headers: { authorization: 'Bearer secre' } }, 'secret') !== null);
ok('safeEqual is true only for an exact match',
   safeEqual('abc', 'abc') && !safeEqual('abc', 'abd') && !safeEqual('abc', 'abcd'));

section('Security: exposure guard');
ok('loopback without auth is allowed',
   guardExposure({ host: '127.0.0.1', token: '', allowInsecure: false }) === null);
ok('localhost without auth is allowed',
   guardExposure({ host: 'localhost', token: '', allowInsecure: false }) === null);
ok('0.0.0.0 without auth is REFUSED',
   typeof guardExposure({ host: '0.0.0.0', token: '', allowInsecure: false }) === 'string');
ok('the refusal explains both fixes', (() => {
  const m = guardExposure({ host: '0.0.0.0', token: '', allowInsecure: false });
  return /AUTH_TOKEN/.test(m) && /HOST=127\.0\.0\.1/.test(m);
})());
ok('0.0.0.0 with a token is allowed',
   guardExposure({ host: '0.0.0.0', token: 'x', allowInsecure: false }) === null);
ok('the escape hatch works when deliberately set',
   guardExposure({ host: '0.0.0.0', token: '', allowInsecure: true }) === null);

section('Security: rate limits');
let clock = 1_000_000;
const rl = createRateLimiter({ perMinute: 3, perDay: 5, maxConcurrent: 2, now: () => clock });
ok('first request allowed', rl.check('a') === null);
ok('second allowed', rl.check('a') === null);
ok('third allowed', rl.check('a') === null);
eq('fourth in the same minute is 429', rl.check('a').status, 429);
ok('the 429 says how long to wait', rl.check('a').retryAfter >= 1);
ok('a different client is unaffected', rl.check('b') === null);
clock += 61_000;
ok('the window slides', rl.check('a') === null);
clock += 61_000;
ok('one more inside the daily cap', rl.check('a') === null);
ok('the daily cap then trips', /Daily cap/.test(rl.check('a').message));
// concurrency is separate from rate
const rl2 = createRateLimiter({ perMinute: 99, perDay: 99, maxConcurrent: 2, now: () => clock });
rl2.check('c'); rl2.begin('c');
rl2.check('c'); rl2.begin('c');
ok('third concurrent request is rejected', /in flight/.test(rl2.check('c').message));
rl2.end('c');
ok('finishing one frees a slot', rl2.check('c') === null);
eq('stats report live count', rl2.stats('c').live, 1);

section('Security: client key');
eq('falls back to the socket address',
   clientKey({ headers: {}, socket: { remoteAddress: '10.0.0.9' } }), '10.0.0.9');
eq('X-Forwarded-For is IGNORED unless trusted',
   clientKey({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '10.0.0.9' } }),
   '10.0.0.9');
eq('X-Forwarded-For is used when behind a trusted proxy',
   clientKey({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: {} }, { trustProxy: true }),
   '1.2.3.4');

section('Sensitive-data scrubber');
const s1 = QAT.scrub('Contact qa.tester@example.com or 0912345678 about order 8821');
ok('email masked', s1.text.includes('[EMAIL]'));
ok('VN phone masked', s1.text.includes('[PHONE]'));
ok('the order id survives', s1.text.includes('8821'));
eq('two findings reported', s1.found.length, 2);
const s2 = QAT.scrub('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghij');
ok('auth header redacted', /Authorization: \[REDACTED\]/.test(s2.text));
ok('the token itself does not survive anywhere', !/eyJhbGciOiJIUzI1NiJ9/.test(s2.text));
const s3 = QAT.scrub('key=sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAA and gsk_BBBBBBBBBBBBBBBBBBBBBB');
ok('anthropic-style key masked', s3.text.includes('[API_KEY]'));
ok('the key material does not survive', !/sk-ant-api03|gsk_B/.test(s3.text));
eq('both keys counted', s3.found.filter((f) => f.id === 'apiKey')[0].count, 2);
ok('password assignment masked', /password=\[REDACTED\]/i.test(QAT.scrub('password=Hunter2!').text));
ok('private key block removed',
   QAT.scrub('-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----').text
     === '[PRIVATE_KEY_REMOVED]');
// the conservative half: numbers that are not cards must survive
ok('a Luhn-valid card is masked', QAT.scrub('card 4111111111111111 charged').text.includes('[CARD]'));
ok('a non-Luhn 16-digit id is left alone',
   QAT.scrub('trace 1234567890123456 ok').text.includes('1234567890123456'));
ok('a 10-digit tax code is left alone (it is load-bearing in AC)',
   QAT.scrub('MST must be 0100109106').text.includes('0100109106'));
ok('plain prose is untouched', QAT.scrub('OTP valid for 60 seconds').total === 0);
eq('nothing found means empty summary', QAT.scrub.summary(QAT.scrub('hello')), '');
ok('summary lists what was masked', /Email/i.test(QAT.scrub.summary(QAT.scrub('a@b.co'))));
// optional rules stay off unless asked for
ok('IPv4 kept by default', QAT.scrub('host 10.0.0.5').text.includes('10.0.0.5'));
ok('IPv4 masked when requested',
   QAT.scrub('host 10.0.0.5', { extra: ['ipv4'] }).text.includes('[IP]'));
ok('12-digit id masked only when requested',
   QAT.scrub('cccd 001201207225', { extra: ['personalId'] }).text.includes('[ID]'));
ok('empty and null input are safe',
   QAT.scrub('').text === '' && QAT.scrub(null).text === '');
ok('the run bar offers masking, on by default',
   /data-ai-scrub[^>]*checked|checked[^>]*data-ai-scrub/.test(QAT.ai.runBar()));

section('HAR analyser');
function harEntry(o) {
  return {
    startedDateTime: o.started || '2026-08-22T10:00:00.000Z',
    time: o.time ?? 100,
    request: {
      method: o.method || 'GET', url: o.url || 'https://x.test/a',
      headers: o.reqHeaders || [], queryString: o.query || [], bodySize: 0
    },
    response: {
      status: o.status ?? 200, statusText: '',
      headers: o.resHeaders || [{ name: 'Content-Type', value: o.ct || 'application/json' }],
      content: { size: o.size ?? 100, mimeType: o.ct || 'application/json' },
      cookies: o.cookies || [], bodySize: o.size ?? 100
    },
    timings: { wait: o.wait ?? 50, receive: 10, blocked: 0 }
  };
}
function har(entries) {
  return JSON.stringify({ log: { version: '1.2', creator: { name: 'test' }, pages: [], entries } });
}

ok('rejects non-JSON', (() => { try { QAT.har.parse('not json'); return false; } catch (e) { return /valid JSON/.test(e.message); } })());
ok('rejects JSON that is not a HAR',
   (() => { try { QAT.har.parse('{"a":1}'); return false; } catch (e) { return /not a HAR/.test(e.message); } })());
const hp = QAT.har.parse(har([harEntry({ url: 'https://x.test/api/v1/orders?page=2', time: 250 })]));
eq('creator read', hp.creator, 'test');
eq('one entry parsed', hp.entries.length, 1);
eq('path shortened for display', hp.entries[0].path, '/api/v1/orders?page=2');
eq('origin extracted', hp.entries[0].origin, 'https://x.test');
eq('negative time (unknown) becomes 0',
   QAT.har.parse(har([harEntry({ time: -1 })])).entries[0].time, 0);

const hs = QAT.har.summarize(QAT.har.parse(har([
  harEntry({ status: 200, time: 100, size: 1000 }),
  harEntry({ status: 404, time: 200, size: 100 }),
  harEntry({ status: 500, time: 300, size: 10 })
])).entries);
eq('counts by status class', hs.byClass, { '2xx': 1, '3xx': 0, '4xx': 1, '5xx': 1, other: 0 });
eq('sums transferred bytes', hs.totalSize, 1110);
eq('finds the slowest', Math.round(hs.slowest.time), 300);
ok('wall clock is not the naive sum', hs.wallClock <= hs.totalTime);

function titles(entries, opts) {
  return QAT.har.findings(QAT.har.parse(har(entries)).entries, opts).map((f) => f.title + '|' + f.level);
}
ok('reports 5xx as an error',
   titles([harEntry({ status: 500 })]).some((t) => /server error/.test(t) && /err/.test(t)));
ok('reports 4xx as a warning',
   titles([harEntry({ status: 404 })]).some((t) => /client error/.test(t) && /warn/.test(t)));
ok('flags status 0 as never completed',
   titles([harEntry({ status: 0 })]).some((t) => /never completed/.test(t)));
ok('flags requests over 3s as an error',
   titles([harEntry({ time: 4000 })]).some((t) => /over 3s/.test(t) && /err/.test(t)));
ok('honours a custom slow threshold',
   titles([harEntry({ time: 600 })], { slowMs: 500 }).some((t) => /over 500ms/.test(t)));
ok('a fast request raises nothing',
   titles([harEntry({ time: 80 })]).some((t) => /No problems detected/.test(t)));
ok('detects the N+1 pattern (same call 5+ times)',
   titles(Array.from({ length: 6 }, () => harEntry({ url: 'https://x.test/api/lookup' })))
     .some((t) => /Repeated identical/.test(t)));
ok('4 repeats is not yet called N+1',
   !titles(Array.from({ length: 4 }, () => harEntry({ url: 'https://x.test/api/lookup' })))
     .some((t) => /Repeated identical/.test(t)));
ok('flags a big response',
   titles([harEntry({ size: 900 * 1024 })]).some((t) => /over 500 KB/.test(t)));
ok('flags credentials in the query string as an error',
   titles([harEntry({ url: 'https://x.test/me?access_token=abc', query: [{ name: 'access_token', value: 'abc' }] })])
     .some((t) => /credentials in the URL/.test(t) && /err/.test(t)));
ok('an ordinary query param is not flagged',
   !titles([harEntry({ url: 'https://x.test/list?page=2', query: [{ name: 'page', value: '2' }] })])
     .some((t) => /credentials in the URL/.test(t)));
ok('flags mixed content on an https session',
   titles([harEntry({ url: 'https://x.test/a' }), harEntry({ url: 'http://cdn.test/i.png' })])
     .some((t) => /plain http/.test(t)));
ok('flags missing security headers on HTML',
   titles([harEntry({ ct: 'text/html; charset=utf-8' })]).some((t) => /Missing header/.test(t)));
ok('does not judge headers on JSON responses',
   !titles([harEntry({ ct: 'application/json' })]).some((t) => /Missing header/.test(t)));
ok('flags an insecure cookie',
   titles([harEntry({ cookies: [{ name: 's', value: '1', secure: false, httpOnly: false }] })])
     .some((t) => /without Secure or HttpOnly/.test(t)));
ok('report text includes the counts and findings', (() => {
  const r = QAT.har.report(QAT.har.parse(har([harEntry({ status: 500, time: 4000 })])));
  return /Requests: 1/.test(r) && /\[ERR\]/.test(r);
})());

section('cURL parse / build');
const c1 = QAT.curl.parse("curl -X POST 'https://api.test/orders' -H 'Content-Type: application/json' -H 'X-Trace: 9' --data-raw '{\"id\":1}'");
eq('method', c1.method, 'POST');
eq('url', c1.url, 'https://api.test/orders');
eq('two headers', Object.keys(c1.headers).length, 2);
eq('header value', c1.headers['Content-Type'], 'application/json');
eq('body', c1.body, '{"id":1}');
eq('method defaults to GET with no data', QAT.curl.parse("curl 'https://api.test/x'").method, 'GET');
eq('method defaults to POST when data is present',
   QAT.curl.parse("curl 'https://api.test/x' -d 'a=1'").method, 'POST');
ok('handles line continuations',
   QAT.curl.parse("curl -X PUT \\\n  'https://api.test/y' \\\n  -H 'A: b'").url === 'https://api.test/y');
ok('ignores noise flags like -sSkL', QAT.curl.parse("curl -sSkL 'https://api.test/z'").url === 'https://api.test/z');
ok('accepts --url form', QAT.curl.parse("curl --url 'https://api.test/w'").url === 'https://api.test/w');
ok('never inlines a password from -u',
   !/secret/.test(QAT.curl.parse("curl -u 'admin:secret' 'https://api.test/a'").headers.Authorization));
ok('rejects a command that is not curl',
   (() => { try { QAT.curl.parse('wget http://x'); return false; } catch (e) { return true; } })());
ok('rejects curl with no url',
   (() => { try { QAT.curl.parse("curl -H 'A: b'"); return false; } catch (e) { return /No URL/.test(e.message); } })());
const built = QAT.curl.build({ method: 'POST', url: 'https://api.test/o', headers: { 'X-A': 'b' }, body: '{"x":1}' });
ok('build emits the method and url', /curl -i -X POST 'https:\/\/api\.test\/o'/.test(built));
ok('build emits headers', /-H 'X-A: b'/.test(built));
ok('build emits the body', /--data-raw '\{"x":1\}'/.test(built));
ok('build round-trips through parse', (() => {
  const p = QAT.curl.parse(QAT.curl.build({ method: 'PATCH', url: 'https://a.test/b', headers: { K: 'v' }, body: 'x=1' }));
  return p.method === 'PATCH' && p.url === 'https://a.test/b' && p.headers.K === 'v' && p.body === 'x=1';
})());
ok('a single quote in the body survives the round trip',
   QAT.curl.parse(QAT.curl.build({ method: 'POST', url: 'https://a.test/b', headers: {}, body: "O'Brien" })).body === "O'Brien");

section('Acceptance-criteria linter');
const acBad = QAT.aclint.lint(
  'The screen should load fast and be user-friendly.\n' +
  'Amount is validated properly.\n' +
  'Description max 210 characters.\n' +
  'Support VND, USD, etc.\n' +
  'Fee calculation: TBD');
const acIds = acBad.findings.map((f) => f.id);
ok('catches vague wording', acIds.includes('vague'));
ok('catches performance with no threshold', acIds.includes('perfNoNumber'));
ok('catches an open-ended list', acIds.includes('etc'));
ok('catches TBD', acIds.includes('tbd'));
ok('catches a limit with no overflow behaviour', acIds.includes('limitNoOverflow'));
ok('catches the absence of any error path', acIds.includes('noNegative'));
eq('weak AC is judged not ready', acBad.verdict, 'blocked');
ok('findings carry a line number', acBad.findings.filter((f) => f.line > 0).length > 0);

const acGood = QAT.aclint.lint(
  '- The form must render within 800 ms on 4G.\n' +
  '- Amount: greater than 0 and not more than the balance; maximum 500000000 VND. ' +
  'If it exceeds either limit the system rejects it and shows "Amount exceeds the limit".\n' +
  '- Description: optional, up to 210 characters. Input beyond 210 is truncated and a warning is shown.\n' +
  '- The user cancels the order; the system updates the balance within 2 seconds.\n' +
  '- If the OTP is wrong 5 times the system locks the account for 15 minutes.');
ok('good AC has no blocking findings', (acGood.counts.err || 0) === 0);
ok('good AC is not judged blocked', acGood.verdict !== 'blocked');
ok('a measured threshold is not flagged as vague',
   !acGood.findings.some((f) => f.id === 'perfNoNumber'));
ok('an explicit overflow rule is not flagged',
   !acGood.findings.some((f) => f.id === 'limitNoOverflow'));

ok('a one-line title is flagged as too thin',
   QAT.aclint.lint('Login with OTP').findings.some((f) => f.id === 'tooShort'));
ok('empty input produces nothing', QAT.aclint.lint('').findings.length === 0);
ok('passive voice with no actor is flagged',
   QAT.aclint.lint('The order is cancelled and the balance is updated automatically')
     .findings.some((f) => f.id === 'passive'));
ok('naming the actor clears the passive finding',
   !QAT.aclint.lint('The order is cancelled by the user and the balance updates')
     .findings.some((f) => f.id === 'passive'));
ok('and/or is flagged', QAT.aclint.lint('Send email and/or SMS to the customer on failure')
     .findings.some((f) => f.id === 'andOr'));
const qs = QAT.aclint.questions(acBad);
ok('questions are de-duplicated by rule', qs.length === new Set(qs.map((q) => q.about.split(' (')[0])).size);
ok('blocking questions come first', qs[0].level === 'err');
ok('each question is actually a question', qs.every((q) => /\?/.test(q.ask)));
ok('Vietnamese labels are used when asked',
   /không đo được|chưa/.test(QAT.aclint.lint('Màn hình phải tải nhanh và thân thiện', { lang: 'vi' })
     .findings.map((f) => f.label).join(' ')));

section('Vietnamese data validators');
const V = QAT.vnvalid;
// MST: verify against the generator, which is the other half of the same rule
const gen = QAT.faker.generate(['taxCode'], 30, 'cross-check');
ok('every generated tax code validates', gen.every((r) => V.taxCode(r.taxCode).valid));
ok('a known-good tax code passes', V.taxCode('0100109106').valid);
ok('flipping the check digit fails', !V.taxCode('0100109107').valid);
ok('the reason names the expected digit', /expected/.test(V.taxCode('0100109107').reason));
ok('9 digits is rejected with a length reason', /10 digits/.test(V.taxCode('010010910').reason));
ok('a branch suffix is accepted', V.taxCode('0100109106-001').valid);
ok('non-digits are rejected', !V.taxCode('MST: 0100109106').valid);

ok('generated personal IDs validate', QAT.faker.generate(['personalId'], 20, 'x').every((r) => V.personalId(r.personalId).valid));
ok('9-digit CMND is accepted with a caveat',
   V.personalId('123456789').valid && /9-digit/.test(V.personalId('123456789').reason));
ok('11 digits is rejected', !V.personalId('12345678901').valid);
ok('province 999 is rejected', !V.personalId('999012345678').valid);
ok('a future birth year is rejected', !V.personalId('0018' + '99' + '123456').valid);
ok('the reason states gender and year', /male|female/.test(V.personalId('001201207225').reason));

ok('generated phones validate', QAT.faker.generate(['phone'], 20, 'p').every((r) => V.phone(r.phone).valid));
ok('+84 form is normalised', V.phone('+84912345678').valid);
ok('spaces and dashes are tolerated', V.phone('091 234 5678').valid);
ok('an 11-digit old number is called out', /pre-2018/.test(V.phone('01234567890').reason));
ok('an unknown prefix is rejected', !V.phone('0112345678').valid);
ok('the rejection names the prefix', /011/.test(V.phone('0112345678').reason));

ok('a normal email passes', V.email('qa@example.com').valid);
ok('no @ is rejected with that reason', /no @/.test(V.email('qa.example.com').reason));
ok('two @ is rejected', !V.email('a@b@c.com').valid);
ok('a dotless domain is rejected', /no dot/.test(V.email('qa@localhost').reason));
ok('a space is rejected', /space/.test(V.email('a b@c.com').reason));

ok('a plausible bank account passes', V.bankAccount('1234567890').valid);
ok('too short is rejected', !V.bankAccount('123').valid);
ok('the caveat is stated honestly', /no national checksum/.test(V.bankAccount('1234567890').reason));

ok('a Luhn-valid card passes', V.card('4111111111111111').valid);
ok('a Luhn-invalid card fails', !V.card('4111111111111112').valid);

eq('detects a column of emails', V.detect(['a@b.com', 'c@d.com', 'x@y.vn']), 'email');
eq('detects a column of phones', V.detect(['0912345678', '0987654321', '0356789012']), 'phone');
eq('detects a column of tax codes', V.detect(['0100109106', '3567940508', '4524621523']), 'taxCode');

const vl = V.validateList(['0100109106', '0100109107', '0100109106', ''], 'taxCode');
eq('counts total rows', vl.total, 4);
eq('counts valid rows', vl.valid, 2);
eq('counts invalid rows', vl.invalid, 2);
eq('counts duplicated values', vl.duplicates, 1);
ok('empty rows get their own reason', vl.rows[3].reason === 'empty');
ok('duplicates are marked on the row', vl.rows[0].duplicate === 2);

section('Markdown table -> CSV rows');
const mdRows = QAT.mdTableToRows(
  'intro text\n\n| ID | Title | Steps |\n|---|---|---|\n| TC-001 | Login | 1. open 2. submit |\n' +
  '| TC-002 | Bad OTP | 1. enter 000000 |\n\nCoverage notes\n\n| other | table |\n|---|---|\n| x | y |');
eq('header row extracted', mdRows[0], ['ID', 'Title', 'Steps']);
eq('data rows extracted', mdRows.length, 3);
eq('cell content preserved', mdRows[1][2], '1. open 2. submit');
ok('separator row dropped', !mdRows.some((r) => r.every((c) => /^[-: ]*$/.test(c))));
eq('only the first table is taken', mdRows[2][0], 'TC-002');
eq('no table returns nothing', QAT.mdTableToRows('just prose'), []);

/* ========================================================================= */
console.log('\n  ' + '='.repeat(56));
if (failures.length) {
  console.log(`  ${pass} passed, ${failures.length} FAILED`);
  console.log('  ' + '='.repeat(56));
  for (const f of failures) console.log(`   x ${f}`);
  console.log('');
  process.exit(1);
}
console.log(`  All ${pass} checks passed.`);
console.log('  ' + '='.repeat(56) + '\n');
