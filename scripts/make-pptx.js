/* =============================================================================
   docs/deck-content.json  ->  out/EmeSoft-QA-Toolkit.pptx
   -----------------------------------------------------------------------------
   Writes the PresentationML package directly. See scripts/ooxml.js for why this
   is not done through PowerPoint itself.

   Palette and type are the product's own, so the deck and the tool read as one
   thing. Contrast on every text/ground pair was measured before these values
   were chosen; the two that matter are noted where they are defined.

   Usage:  node scripts/make-pptx.js [out/File.pptx]
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip, xe, XML_DECL } from './ooxml.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EMU = 12700;                    // per point
const pt = (v) => Math.round(v * EMU);
const SLIDE_W = 960, SLIDE_H = 540;   // points, 16:9

const PAPER = 'FBFAF8', INK = '252724', INK2 = '4A4C47';
const MUTED = '68695F';               // 5.33:1 on PAPER; the warmer grey read 4.09
const BRAND = 'D3222A', LINE = 'E4E1DB', WHITE = 'FFFFFF', GOOD = '1F7A4D';
const INVBG = '1C1E1B', INVFG = 'F5F3EF', INVMUT = 'A3A59D';
const INVRED = 'F2555C';              // 4.98:1 on INVBG; the darker red reads 3.22

const DISPLAY = 'Montserrat';
const MONO = 'Consolas';
const L = 72, W = 816;                // left margin, content width

/* ------------------------------------------------------------------ shapes */
let shapeId = 1;

function txBody(paras, opts = {}) {
  return '<p:txBody>' +
    '<a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="' + (opts.anchor || 't') + '"><a:noAutofit/></a:bodyPr>' +
    '<a:lstStyle/>' + paras.join('') + '</p:txBody>';
}

/**
 * @param {string} text                may contain \n for extra paragraphs
 * @param {{font,size,bold,color,align,space,lineSpc}} f
 */
function paraXml(text, f) {
  const align = f.align || 'l';
  const spc = f.space == null ? 0 : f.space;
  return String(text).split('\n').map((lineText) =>
    '<a:p><a:pPr algn="' + align + '">' +
    '<a:lnSpc><a:spcPct val="' + Math.round((f.lineSpc || 0.92) * 100000) + '"/></a:lnSpc>' +
    '<a:spcAft><a:spcPts val="' + Math.round(spc * 100) + '"/></a:spcAft>' +
    '</a:pPr>' +
    (lineText === ''
      ? '<a:endParaRPr sz="' + Math.round(f.size * 100) + '"/>'
      : '<a:r><a:rPr lang="vi-VN" dirty="0" sz="' + Math.round(f.size * 100) + '"' +
        (f.bold ? ' b="1"' : '') + ' spc="' + Math.round((f.spc || 0) * 100) + '">' +
        '<a:solidFill><a:srgbClr val="' + f.color + '"/></a:solidFill>' +
        '<a:latin typeface="' + xe(f.font) + '"/><a:cs typeface="' + xe(f.font) + '"/>' +
        '</a:rPr><a:t>' + xe(lineText) + '</a:t></a:r>') +
    '</a:p>').join('');
}

function textBox(x, y, w, h, text, f) {
  const id = ++shapeId;
  return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="t' + id + '"/>' +
    '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
    '<p:spPr><a:xfrm><a:off x="' + pt(x) + '" y="' + pt(y) + '"/>' +
    '<a:ext cx="' + pt(w) + '" cy="' + pt(h) + '"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
    txBody([paraXml(text, f)]) + '</p:sp>';
}

/** A filled rectangle carrying pre-built paragraphs (used for the code panels). */
function panel(x, y, w, h, paras, fill, stroke, pad = 18) {
  const id = ++shapeId;
  return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="p' + id + '"/>' +
    '<p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
    '<p:spPr><a:xfrm><a:off x="' + pt(x) + '" y="' + pt(y) + '"/>' +
    '<a:ext cx="' + pt(w) + '" cy="' + pt(h) + '"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    '<a:solidFill><a:srgbClr val="' + fill + '"/></a:solidFill>' +
    '<a:ln w="9525"><a:solidFill><a:srgbClr val="' + stroke + '"/></a:solidFill></a:ln></p:spPr>' +
    '<p:txBody><a:bodyPr wrap="square" lIns="' + pt(pad) + '" tIns="' + pt(pad * 0.8) +
    '" rIns="' + pt(pad) + '" bIns="' + pt(pad * 0.8) + '"><a:noAutofit/></a:bodyPr>' +
    // A txBody must carry at least one paragraph. The card panels on slide 7 are
    // empty frames with the text laid over them, and shipping them with none
    // made PowerPoint reject the whole presentation rather than that one shape.
    '<a:lstStyle/>' + (paras.length ? paras.join('') : '<a:p/>') + '</p:txBody></p:sp>';
}

function hLine(x, y, w, color) {
  const id = ++shapeId;
  return '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="' + id + '" name="l' + id + '"/>' +
    '<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>' +
    '<p:spPr><a:xfrm><a:off x="' + pt(x) + '" y="' + pt(y) + '"/>' +
    '<a:ext cx="' + pt(w) + '" cy="0"/></a:xfrm>' +
    '<a:prstGeom prst="line"><a:avLst/></a:prstGeom>' +
    '<a:ln w="15875"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill></a:ln>' +
    '</p:spPr></p:cxnSp>';
}

function tableFrame(x, y, widths, rows, headerFill) {
  const id = ++shapeId;
  const rowH = 30;
  const cell = (runsText, isHead, isLast) => {
    const f = isHead
      ? { font: DISPLAY, size: 11.5, bold: true, color: WHITE }
      : { font: isLast ? MONO : DISPLAY, size: 14, bold: isLast, color: isLast ? BRAND : INK };
    return '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>' +
      paraXml(runsText, Object.assign({ align: isLast ? 'r' : 'l', lineSpc: 1 }, f)) +
      '</a:txBody><a:tcPr marL="' + pt(12) + '" marR="' + pt(12) + '" marT="' + pt(6) +
      '" marB="' + pt(6) + '" anchor="ctr">' +
      '<a:lnL w="9525"><a:solidFill><a:srgbClr val="' + LINE + '"/></a:solidFill></a:lnL>' +
      '<a:lnR w="9525"><a:solidFill><a:srgbClr val="' + LINE + '"/></a:solidFill></a:lnR>' +
      '<a:lnT w="9525"><a:solidFill><a:srgbClr val="' + LINE + '"/></a:solidFill></a:lnT>' +
      '<a:lnB w="9525"><a:solidFill><a:srgbClr val="' + LINE + '"/></a:solidFill></a:lnB>' +
      '<a:solidFill><a:srgbClr val="' + (isHead ? headerFill : WHITE) + '"/></a:solidFill>' +
      '</a:tcPr></a:tc>';
  };

  const trs = rows.map((r, ri) =>
    '<a:tr h="' + pt(rowH) + '">' +
    r.map((c, ci) => cell(c, ri === 0, ci === r.length - 1)).join('') +
    '</a:tr>').join('');

  return '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="' + id + '" name="tbl"/>' +
    '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>' +
    '<p:xfrm><a:off x="' + pt(x) + '" y="' + pt(y) + '"/>' +
    '<a:ext cx="' + pt(widths.reduce((a, b) => a + b, 0)) + '" cy="' + pt(rowH * rows.length) + '"/></p:xfrm>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">' +
    '<a:tbl><a:tblPr firstRow="1"/><a:tblGrid>' +
    widths.map((w) => '<a:gridCol w="' + pt(w) + '"/>').join('') +
    '</a:tblGrid>' + trs + '</a:tbl></a:graphicData></a:graphic></p:graphicFrame>';
}

/* ------------------------------------------------------------------ slides */

function slideXml(sl, deck) {
  const inv = !!sl.invert;
  const fgMain = inv ? INVFG : INK;
  const fgSoft = inv ? INVMUT : INK2;
  const fgMute = inv ? INVMUT : MUTED;
  const accent = inv ? INVRED : BRAND;
  const bg = inv ? INVBG : PAPER;
  const s = [];

  s.push(textBox(L, 60, W, 22, sl.eyebrow.toUpperCase(),
    { font: DISPLAY, size: 11.5, bold: true, color: fgMute, spc: 2.2, lineSpc: 1 }));

  const isTitle = sl.type === 'title', isClose = sl.type === 'close';
  const hSize = isTitle ? 54 : isClose ? 50 : 38;
  const hTop = isTitle ? 146 : isClose ? 168 : 110;
  const hHeight = hSize * 1.24 * sl.heading.length;
  s.push(textBox(L, hTop, W, hHeight, sl.heading.join('\n'),
    { font: DISPLAY, size: hSize, bold: true, color: fgMain, lineSpc: 1.0 }));
  let y = hTop + hHeight + 24;

  const bulletBlock = (items, size, color, yy, width = 780) => {
    const text = items.map((b) => '–   ' + b).join('\n');
    s.push(textBox(L, yy, width, 26 * items.length + 30, text,
      { font: DISPLAY, size, color, space: 7, lineSpc: 1.05 }));
  };

  switch (sl.type) {
    case 'title':
      s.push(hLine(L, y, 96, BRAND));
      y += 30;
      s.push(textBox(L, y, 706, 84, sl.lede, { font: DISPLAY, size: 17, color: INK2, lineSpc: 1.2 }));
      s.push(textBox(L, y + 100, 500, 24, deck.url, { font: MONO, size: 13, color: BRAND, lineSpc: 1 }));
      break;

    case 'close':
      s.push(hLine(L, y, 96, BRAND));
      y += 28;
      s.push(textBox(L, y, 720, 34, sl.lede, { font: DISPLAY, size: 18, color: INK2, lineSpc: 1.2 }));
      s.push(textBox(L, y + 56, 500, 24, deck.url, { font: MONO, size: 13, color: MUTED, lineSpc: 1 }));
      break;

    case 'text':
      for (const p of sl.paras) {
        const h = 30 + Math.ceil(p.length / 74) * 27;
        s.push(textBox(L, y, 730, h, p, { font: DISPLAY, size: 18, color: fgSoft, lineSpc: 1.18 }));
        y += h + 10;
      }
      s.push(hLine(L, y + 6, 96, LINE));
      s.push(textBox(L, y + 28, 706, 58, sl.note, { font: DISPLAY, size: 13.5, color: fgMute, lineSpc: 1.2 }));
      break;

    case 'table': {
      const rows = [sl.header].concat(sl.rows);
      s.push(tableFrame(L, y, [186, 524, 106], rows, INK));
      s.push(textBox(L, y + 30 * rows.length + 22, W, 26, sl.note,
        { font: DISPLAY, size: 13, color: MUTED, lineSpc: 1 }));
      break;
    }

    case 'stats': {
      sl.stats.forEach((st, k) => {
        const x = L + k * 268;
        s.push(textBox(x, y, 240, 58, st.n, { font: MONO, size: 44, bold: true, color: accent, lineSpc: 1 }));
        s.push(textBox(x, y + 62, 224, 48, st.label, { font: DISPLAY, size: 12, color: fgMute, lineSpc: 1.15 }));
      });
      y += 128;
      if (sl.lede) {
        s.push(textBox(L, y, 748, 80, sl.lede, { font: DISPLAY, size: 16.5, color: fgMain, lineSpc: 1.2 }));
        y += 92;
      }
      if (sl.bullets) bulletBlock(sl.bullets, 14, fgMain, y);
      if (sl.note) s.push(textBox(L, y, 706, 40, sl.note, { font: DISPLAY, size: 12, color: fgMute, lineSpc: 1.2 }));
      break;
    }

    case 'code': {
      const paras = sl.code.map((c) => paraXml(c.t === '' ? '' : c.t, {
        font: MONO, size: 14, lineSpc: 1.25, space: 0,
        bold: c.c === 'bad' || c.c === 'good',
        color: c.c === 'bad' ? BRAND : c.c === 'good' ? GOOD : c.c === 'dim' ? MUTED : INK
      }));
      const h = 26 * sl.code.length + 32;
      s.push(panel(L, y, sl.codeWidth, h, paras, WHITE, LINE));
      y += h + 26;
      s.push(textBox(L, y, 748, 58, sl.lede, { font: DISPLAY, size: 16, color: INK2, lineSpc: 1.2 }));
      y += 70;
      if (sl.bullets) bulletBlock(sl.bullets, 13.5, INK, y);
      break;
    }

    case 'cards':
      sl.cards.forEach((c, k) => {
        const x = L + k * 274;
        s.push(panel(x, y, 254, 176, [], WHITE, LINE));
        s.push(textBox(x + 18, y + 18, 214, 20, c.n, { font: MONO, size: 12, bold: true, color: BRAND, lineSpc: 1 }));
        s.push(textBox(x + 18, y + 42, 214, 26, c.title, { font: DISPLAY, size: 15, bold: true, color: INK, lineSpc: 1.05 }));
        s.push(textBox(x + 18, y + 74, 214, 94, c.body, { font: DISPLAY, size: 12, color: MUTED, lineSpc: 1.2 }));
      });
      s.push(textBox(L, y + 200, 760, 60, sl.lede, { font: DISPLAY, size: 16, color: INK2, lineSpc: 1.2 }));
      break;

    case 'bullets':
      if (sl.showUrlBig) {
        s.push(textBox(L, y, 700, 44, deck.url, { font: MONO, size: 26, bold: true, color: BRAND, lineSpc: 1 }));
        y += 64;
        s.push(hLine(L, y, 96, LINE));
        y += 28;
      }
      bulletBlock(sl.bullets, 16, INK, y);
      break;
  }

  return XML_DECL +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
    ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="' + bg + '"/></a:solidFill>' +
    '<a:effectLst/></p:bgPr></p:bg>' +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    s.join('') +
    '</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"' +
    ' accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5"' +
    ' accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sld>';
}

/* --------------------------------------------------------- fixed packaging */

const THEME = XML_DECL +
  '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="EmeSoft">' +
  '<a:themeElements>' +
  '<a:clrScheme name="EmeSoft"><a:dk1><a:srgbClr val="' + INK + '"/></a:dk1>' +
  '<a:lt1><a:srgbClr val="' + PAPER + '"/></a:lt1>' +
  '<a:dk2><a:srgbClr val="' + INVBG + '"/></a:dk2><a:lt2><a:srgbClr val="' + LINE + '"/></a:lt2>' +
  '<a:accent1><a:srgbClr val="' + BRAND + '"/></a:accent1>' +
  '<a:accent2><a:srgbClr val="' + INVRED + '"/></a:accent2>' +
  '<a:accent3><a:srgbClr val="' + MUTED + '"/></a:accent3>' +
  '<a:accent4><a:srgbClr val="' + INK2 + '"/></a:accent4>' +
  '<a:accent5><a:srgbClr val="' + GOOD + '"/></a:accent5>' +
  '<a:accent6><a:srgbClr val="' + INVMUT + '"/></a:accent6>' +
  '<a:hlink><a:srgbClr val="' + BRAND + '"/></a:hlink>' +
  '<a:folHlink><a:srgbClr val="' + MUTED + '"/></a:folHlink></a:clrScheme>' +
  '<a:fontScheme name="EmeSoft">' +
  '<a:majorFont><a:latin typeface="' + DISPLAY + '"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
  '<a:minorFont><a:latin typeface="' + DISPLAY + '"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
  '</a:fontScheme>' +
  '<a:fmtScheme name="EmeSoft">' +
  '<a:fillStyleLst>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '</a:fillStyleLst>' +
  '<a:lnStyleLst>' +
  ['9525', '15875', '25400'].map((w) =>
    '<a:ln w="' + w + '" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:prstDash val="solid"/></a:ln>').join('') +
  '</a:lnStyleLst>' +
  '<a:effectStyleLst>' +
  '<a:effectStyle><a:effectLst/></a:effectStyle>' +
  '<a:effectStyle><a:effectLst/></a:effectStyle>' +
  '<a:effectStyle><a:effectLst/></a:effectStyle>' +
  '</a:effectStyleLst>' +
  '<a:bgFillStyleLst>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '</a:bgFillStyleLst>' +
  '</a:fmtScheme></a:themeElements></a:theme>';

const EMPTY_TREE =
  '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
  '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';

const NS = ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
  ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
  ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const SLIDE_MASTER = XML_DECL +
  '<p:sldMaster' + NS + '><p:cSld><p:bg><p:bgPr>' +
  '<a:solidFill><a:srgbClr val="' + PAPER + '"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
  EMPTY_TREE + '</p:cSld>' +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2"' +
  ' accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6"' +
  ' hlink="hlink" folHlink="folHlink"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
  // PowerPoint refuses to open the file outright if the master has no txStyles,
  // even though every slide here sets its own type explicitly and never inherits
  // from these. The schema marks the element optional; the application does not.
  '<p:txStyles>' +
  ['titleStyle', 'bodyStyle', 'otherStyle'].map((k) =>
    '<p:' + k + '><a:lvl1pPr algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">' +
    '<a:defRPr sz="' + (k === 'titleStyle' ? 4400 : 1800) + '" kern="1200">' +
    '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>' +
    '<a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/>' +
    '</a:defRPr></a:lvl1pPr></p:' + k + '>').join('') +
  '</p:txStyles>' +
  '</p:sldMaster>';

const SLIDE_LAYOUT = XML_DECL +
  '<p:sldLayout' + NS + ' type="blank" preserve="1"><p:cSld name="Blank">' +
  EMPTY_TREE + '</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

function presentationXml(count) {
  const ids = Array.from({ length: count }, (_, i) =>
    '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>').join('');
  return XML_DECL +
    '<p:presentation' + NS + ' saveSubsetFonts="1">' +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    '<p:sldIdLst>' + ids + '</p:sldIdLst>' +
    '<p:sldSz cx="' + pt(SLIDE_W) + '" cy="' + pt(SLIDE_H) + '"/>' +
    '<p:notesSz cx="' + pt(SLIDE_H) + '" cy="' + pt(SLIDE_W) + '"/>' +
    '</p:presentation>';
}

/* PowerPoint expects these three even though the schema calls them optional,
   and refuses the whole package when they are absent. tableStyles in particular
   is needed the moment a slide contains an a:tbl, which slide 3 does. */
const PRES_PROPS = XML_DECL + '<p:presentationPr' + NS + '/>';
const VIEW_PROPS = XML_DECL + '<p:viewPr' + NS + '/>';
const TABLE_STYLES = XML_DECL +
  '<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
  ' def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>';

const REL = (id, type, target) =>
  '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/' +
  type + '" Target="' + target + '"/>';
const RELS = (inner) => XML_DECL +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + inner + '</Relationships>';

/** @returns {Buffer} the .pptx package */
export function buildPptx(deck) {
  shapeId = 1;
  const slides = deck.slides.map((sl) => slideXml(sl, deck));
  const n = slides.length;

  const files = [
    {
      name: '[Content_Types].xml', data: XML_DECL +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
        '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>' +
        '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>' +
        '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>' +
        slides.map((_, i) => '<Override PartName="/ppt/slides/slide' + (i + 1) +
          '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('') +
        '</Types>'
    },
    { name: '_rels/.rels', data: RELS(REL('rId1', 'officeDocument', 'ppt/presentation.xml')) },
    { name: 'ppt/presentation.xml', data: presentationXml(n) },
    {
      name: 'ppt/_rels/presentation.xml.rels', data: RELS(
        REL('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml') +
        slides.map((_, i) => REL('rId' + (i + 2), 'slide', 'slides/slide' + (i + 1) + '.xml')).join('') +
        REL('rId' + (n + 2), 'theme', 'theme/theme1.xml') +
        REL('rId' + (n + 3), 'presProps', 'presProps.xml') +
        REL('rId' + (n + 4), 'viewProps', 'viewProps.xml') +
        REL('rId' + (n + 5), 'tableStyles', 'tableStyles.xml'))
    },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: SLIDE_MASTER },
    {
      name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: RELS(
        REL('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml') +
        REL('rId2', 'theme', '../theme/theme1.xml'))
    },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: SLIDE_LAYOUT },
    {
      name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      data: RELS(REL('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml'))
    },
    { name: 'ppt/theme/theme1.xml', data: THEME },
    { name: 'ppt/presProps.xml', data: PRES_PROPS },
    { name: 'ppt/viewProps.xml', data: VIEW_PROPS },
    { name: 'ppt/tableStyles.xml', data: TABLE_STYLES }
  ];

  slides.forEach((xml, i) => {
    files.push({ name: 'ppt/slides/slide' + (i + 1) + '.xml', data: xml });
    files.push({
      name: 'ppt/slides/_rels/slide' + (i + 1) + '.xml.rels',
      data: RELS(REL('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'))
    });
  });

  return zip(files);
}

function main(argv) {
  const dest = path.resolve(ROOT, argv[0] || 'out/EmeSoft-QA-Toolkit.pptx');
  const deck = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/deck-content.json'), 'utf8'));
  const buf = buildPptx(deck);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log('pptx OK - ' + deck.slides.length + ' slide, ' + (buf.length / 1024).toFixed(0) + ' KB -> ' +
    path.relative(ROOT, dest).split(path.sep).join('/'));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
