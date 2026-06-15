// Export leads to a CSV file (semicolon-separated, Excel/Italy-friendly, UTF-8 BOM).
// Round-trips with the in-app CSV importer (which auto-detects the delimiter).

const COLS = [
  ['azienda', 'Azienda'],
  ['categoria', 'Categoria'],
  ['commerciale_assegnato', 'Commerciale'],
  ['fase_pipeline', 'Fase'],
  ['referente', 'Referente'],
  ['ruolo_referente', 'Ruolo'],
  ['telefono', 'Telefono'],
  ['email', 'Email'],
  ['citta', 'Città'],
  ['sito_web', 'Sito'],
  ['sensibility', 'Sensibility'],
  ['quantita_minima_kg', 'Kg'],
  ['prossima_azione', 'Prossima azione'],
  ['data_prossimo_followup', 'Prossimo follow-up'],
  ['data_scadenza', 'Scadenza'],
  ['note', 'Note'],
];

function cell(v) {
  const s = v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportLeadsCsv(items, filename = 'lead-cafezal.csv') {
  const header = COLS.map(([, label]) => label).join(';');
  const rows = (items || []).map((o) => COLS.map(([key]) => cell(o[key])).join(';'));
  const csv = '﻿' + [header, ...rows].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
