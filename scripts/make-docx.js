/* =============================================================================
   docs/DEMO-SCRIPT.md  ->  out/EmeSoft-QA-Toolkit-Demo-Script.docx
   -----------------------------------------------------------------------------
   Writes the WordprocessingML package directly. See scripts/ooxml.js for why
   this is not done through Word itself.

   Usage:  node scripts/make-docx.js [out/File.docx]
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from './md-parse.js';
import { zip, xe, XML_DECL } from './ooxml.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Word measures in half-points for type and twentieths of a point for space. */
const hp = (pt) => Math.round(pt * 2);
const tw = (pt) => Math.round(pt * 20);

/* the product's palette, minus the leading # that OOXML does not take */
const INK = '252724', BRAND = 'D3222A', MUTED = '68695F', LINE = 'E4E1DB';
const CODEBG = 'F7F5F1', QUOTEBG = 'FBF3F3', DEEPRED = 'B81C24';

const DISPLAY = 'Montserrat';
const BODY = 'Segoe UI';         // present on every Windows machine
const MONO = 'Consolas';

/** @param {Array<{t:string,b?:boolean,code?:boolean}>} runs */
function runsXml(runs, base = {}) {
  return runs.map((r) => {
    const font = r.code ? MONO : (base.font || BODY);
    const size = r.code ? (base.size ? base.size - 1 : 9.5) : (base.size || 11);
    const color = r.code ? DEEPRED : (base.color || INK);
    const bold = (r.b || base.bold) ? '<w:b/>' : '';
    // xml:space matters: Word eats leading and trailing spaces without it, and
    // runs are split exactly at the bold and code boundaries
    return '<w:r><w:rPr><w:rFonts w:ascii="' + xe(font) + '" w:hAnsi="' + xe(font) + '"/>' +
      bold + '<w:color w:val="' + color + '"/><w:sz w:val="' + hp(size) + '"/>' +
      (r.code ? '<w:shd w:val="clear" w:fill="F3F1EC"/>' : '') +
      '</w:rPr><w:t xml:space="preserve">' + xe(r.t) + '</w:t></w:r>';
  }).join('');
}

function para(content, opts = {}) {
  const pPr = ['<w:pPr>'];
  if (opts.style) pPr.push('<w:pStyle w:val="' + opts.style + '"/>');
  pPr.push('<w:spacing w:before="' + tw(opts.before || 0) + '" w:after="' + tw(opts.after == null ? 6 : opts.after) + '" w:line="264" w:lineRule="auto"/>');
  if (opts.indent) pPr.push('<w:ind w:left="' + tw(opts.indent) + '"/>');
  if (opts.shade) pPr.push('<w:shd w:val="clear" w:fill="' + opts.shade + '"/>');
  if (opts.leftBar) {
    pPr.push('<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="' + opts.leftBar + '"/></w:pBdr>');
  }
  if (opts.rule) {
    pPr.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="' + LINE + '"/></w:pBdr>');
  }
  if (opts.keepNext) pPr.push('<w:keepNext/>');
  pPr.push('</w:pPr>');
  return '<w:p>' + pPr.join('') + content + '</w:p>';
}

function tableXml(block) {
  const cols = block.header.length;
  // total usable width on A4 with 2.2cm margins, in twentieths of a point
  const total = 9300;
  const first = Math.round(total * 0.26);
  const restW = Math.round((total - first) / (cols - 1));

  const cell = (runs, isHead, w) =>
    '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' +
    (isHead ? '<w:shd w:val="clear" w:fill="' + INK + '"/>' : '') +
    '<w:tcMar><w:top w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/>' +
    '<w:left w:w="110" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar>' +
    '</w:tcPr>' +
    para(runsXml(runs, isHead
      ? { font: DISPLAY, size: 9.5, bold: true, color: 'FFFFFF' }
      : { size: 10 }), { after: 0 }) +
    '</w:tc>';

  const rowXml = (cells, isHead) => '<w:tr>' +
    (isHead ? '<w:trPr><w:tblHeader/></w:trPr>' : '') +
    cells.map((c, i) => cell(c, isHead, i === 0 ? first : restW)).join('') + '</w:tr>';

  return '<w:tbl><w:tblPr><w:tblW w:w="' + total + '" w:type="dxa"/>' +
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((s) => '<w:' + s + ' w:val="single" w:sz="4" w:color="' + LINE + '"/>').join('') +
    '</w:tblBorders></w:tblPr>' +
    rowXml(block.header, true) +
    block.rows.map((r) => rowXml(r, false)).join('') +
    '</w:tbl>' + para('', { after: 8 });
}

function body(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'h': {
        const size = [0, 22, 15, 12.5, 11][b.level];
        const color = b.level === 2 ? BRAND : INK;
        out.push(para(runsXml(b.runs, { font: DISPLAY, size, bold: true, color }), {
          style: 'Heading' + b.level,
          before: b.level === 1 ? 0 : (b.level === 2 ? 16 : 10),
          after: b.level === 2 ? 6 : 4,
          rule: b.level === 2,
          keepNext: true
        }));
        break;
      }
      case 'p':
        out.push(para(runsXml(b.runs), { after: 7 }));
        break;
      case 'ul':
        for (const it of b.items) {
          out.push(para(runsXml([{ t: '•   ' }].concat(it)), { indent: 12, after: 4 }));
        }
        out.push(para('', { after: 4 }));
        break;
      case 'quote':
        out.push(para(runsXml(b.runs, { size: 10.5 }), {
          indent: 8, before: 4, after: 9, shade: QUOTEBG, leftBar: BRAND
        }));
        break;
      case 'pre': {
        const lines = b.text.split('\n');
        lines.forEach((l, i) => {
          out.push(para(runsXml([{ t: l || ' ' }], { font: MONO, size: 9.5 }), {
            indent: 8, after: i === lines.length - 1 ? 9 : 0, shade: CODEBG, leftBar: BRAND
          }));
        });
        break;
      }
      case 'table':
        out.push(tableXml(b));
        break;
      case 'hr':
        out.push(para('', { after: 8, rule: true }));
        break;
    }
  }
  return out.join('');
}

/* Heading styles so Word's navigation pane and any table of contents work.
   Everything else is direct formatting, which is fine for a generated file. */
const STYLES = XML_DECL +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr>' +
  '<w:rFonts w:ascii="' + BODY + '" w:hAnsi="' + BODY + '"/><w:sz w:val="22"/>' +
  '</w:rPr></w:rPrDefault></w:docDefaults>' +
  [1, 2, 3, 4].map((n) =>
    '<w:style w:type="paragraph" w:styleId="Heading' + n + '">' +
    '<w:name w:val="heading ' + n + '"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:outlineLvl w:val="' + (n - 1) + '"/></w:pPr></w:style>').join('') +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  '</w:styles>';

function document(blocks) {
  return XML_DECL +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' + body(blocks) +
    // A4 portrait, 2.2cm side margins — room to write notes while presenting
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1247" w:bottom="1134" w:left="1247" w:header="708" w:footer="708" w:gutter="0"/>' +
    '</w:sectPr></w:body></w:document>';
}

const CONTENT_TYPES = XML_DECL +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '</Types>';

const ROOT_RELS = XML_DECL +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const DOC_RELS = XML_DECL +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

/** @returns {Buffer} the .docx package */
export function buildDocx(md) {
  const blocks = parse(md);
  return zip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'word/document.xml', data: document(blocks) },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS },
    { name: 'word/styles.xml', data: STYLES }
  ]);
}

function main(argv) {
  const dest = path.resolve(ROOT, argv[0] || 'out/EmeSoft-QA-Toolkit-Demo-Script.docx');
  const md = fs.readFileSync(path.join(ROOT, 'docs/DEMO-SCRIPT.md'), 'utf8');
  const buf = buildDocx(md);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log('docx OK - ' + (buf.length / 1024).toFixed(0) + ' KB -> ' +
    path.relative(ROOT, dest).split(path.sep).join('/'));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
