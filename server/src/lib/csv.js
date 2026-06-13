// Minimal, dependency-free CSV parser (RFC-4180-ish).
// Auto-detects the delimiter (comma / semicolon / tab — Italian Excel uses ';'),
// supports quoted fields, escaped quotes ("") and CRLF/CR/LF line endings.

function detectDelimiter(firstLine) {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ',';
}

/**
 * Parse CSV text into { headers, rows, delimiter }.
 * `rows` is an array of objects keyed by the (trimmed) header names.
 */
export function parseCsv(text) {
  const s = String(text || '')
    .replace(/^﻿/, '') // strip BOM
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const nl = s.indexOf('\n');
  const delim = detectDelimiter(nl === -1 ? s : s.slice(0, nl));

  const records = [];
  let rec = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      rec.push(field);
      field = '';
    } else if (c === '\n') {
      rec.push(field);
      records.push(rec);
      rec = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || rec.length > 0) {
    rec.push(field);
    records.push(rec);
  }

  if (!records.length) return { headers: [], rows: [], delimiter: delim };

  const headers = records[0].map((h) => h.trim());
  const rows = [];
  for (let r = 1; r < records.length; r++) {
    const cells = records[r];
    if (cells.length === 1 && cells[0].trim() === '') continue; // blank line
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? '').trim();
    });
    rows.push(obj);
  }
  return { headers, rows, delimiter: delim };
}

/** Normalize a string for case/accent/punctuation-insensitive matching. */
export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
