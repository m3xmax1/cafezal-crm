// ============================================================
//  Writer .xlsx minimale SENZA dipendenze (zip "stored" + XML SpreadsheetML).
//  buildXlsx([{ name, cols?: [numero larghezze], rows: [[celle...]] }]) → Buffer
//  Celle: number → numerica; string/boolean → testo inline; null/undefined → vuota.
// ============================================================

// ── CRC32 (tabella standard) ──
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// ── zip senza compressione (metodo 0 = stored): semplice e deterministico ──
function buildZip(entries) {
  const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01, fisso
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; };

  for (const { name, data } of entries) {
    const nameB = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(DOS_DATE),
      u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0),
      nameB, data,
    ]);
    central.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(DOS_DATE),
      u32(crc), u32(data.length), u32(data.length), u16(nameB.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameB,
    ]));
    chunks.push(local);
    offset += local.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBuf.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

// ── XML helpers ──
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  // eslint-disable-next-line no-control-regex
  .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

function colLetter(i) { // 0-based → A, B, … AA
  let s = '';
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

function sheetXml({ cols = [], rows }) {
  let colsXml = '';
  if (cols.length) {
    colsXml = `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  }
  const rowsXml = rows.map((row, ri) => {
    const cells = row.map((v, ci) => {
      if (v === null || v === undefined || v === '') return '';
      const ref = `${colLetter(ci)}${ri + 1}`;
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsXml}<sheetData>${rowsXml}</sheetData></worksheet>`;
}

const sanitizeName = (s, i) => (String(s || `Foglio${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31)) || `Foglio${i + 1}`;

/** sheets: [{ name, cols?: [larghezze], rows: [[celle]] }] → Buffer .xlsx */
export function buildXlsx(sheets) {
  const names = sheets.map((s, i) => sanitizeName(s.name, i));
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
</Relationships>`;

  const entries = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(sheetXml(s), 'utf8') })),
  ];
  return buildZip(entries);
}
