/* =============================================================================
   A ZIP writer, because .docx and .pptx are ZIP archives of XML.
   -----------------------------------------------------------------------------
   Driving Word and PowerPoint through COM was the obvious route and it does not
   work here: the automation server wedges indefinitely when the script runs as
   a file, while the identical calls finish in two seconds inline. Rather than
   ship something that hangs on the user's machine, the files are written
   directly. Node has zlib, so this needs nothing installed and cannot hang.

   Only what OOXML requires: deflate, no ZIP64, no data descriptors, one fixed
   timestamp so the same input always produces the same bytes.
   ========================================================================== */

import zlib from 'node:zlib';

/* ------------------------------------------------------------------- crc32 */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

export function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* A fixed, valid DOS timestamp: 2024-01-01 00:00. Reproducible output matters
   more than a real mtime for a generated document. */
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

/**
 * @param {Array<{name: string, data: Buffer|string}>} files
 * @returns {Buffer} the archive
 */
export function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const name = Buffer.from(f.name, 'utf8');
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);            // version needed to extract
    lh.writeUInt16LE(0x0800, 6);        // flag: names are UTF-8
    lh.writeUInt16LE(8, 8);             // method: deflate
    lh.writeUInt16LE(DOS_TIME, 10);
    lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    local.push(lh, name, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);            // version made by
    ch.writeUInt16LE(20, 6);            // version needed
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(DOS_TIME, 12);
    ch.writeUInt16LE(DOS_DATE, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += lh.length + name.length + comp.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...local, centralBuf, end]);
}

/* --------------------------------------------------------------------- xml */

/** Escape text for an XML text node or attribute value. */
export function xe(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // control characters are not legal in XML 1.0 and make Office refuse the file
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
