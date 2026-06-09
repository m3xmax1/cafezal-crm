import { FASI } from './constants.js';

const SENS_COLOR = { low: '#16a34a', mid: '#d97706', high: '#dc2626' };

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  if (!y) return d;
  return `${day}/${m}/${y}`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the daily recap email (inline CSS for max email-client compatibility).
 * @param {{commerciale:string, due:Array, recap:Object, daysAhead:number, today:string}} p
 */
export function buildReminderEmail({ commerciale, due = [], recap = {}, daysAhead = 3, today }) {
  const dueRows = due.length
    ? due
        .map(
          (o) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(o.azienda)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(o.fase_pipeline)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;">
            <span style="color:#fff;background:${SENS_COLOR[o.sensibility] || '#6b7280'};padding:2px 8px;border-radius:9999px;font-size:12px;">${escapeHtml(o.sensibility)}</span>
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;">${o.quantita_minima_kg ?? '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;color:#b91c1c;">${fmtDate(o.data_scadenza)}</td>
        </tr>`,
        )
        .join('')
    : `<tr><td colspan="5" style="padding:14px 10px;color:#6b7280;">Nessuna opportunità in scadenza nei prossimi ${daysAhead} giorni 🎉</td></tr>`;

  const recapRows = FASI.map(
    (f) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(f)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${recap[f] || 0}</td>
      </tr>`,
  ).join('');

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
    <div style="background:#1e293b;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;">☕ Cafezal CRM — Recap Giornaliero</h1>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:14px;">Ciao ${escapeHtml(commerciale)}, ecco il tuo riepilogo del ${fmtDate(today)}.</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 12px 12px;background:#ffffff;">
      <h2 style="font-size:16px;margin:0 0 10px;">📅 In scadenza (prossimi ${daysAhead} giorni)</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;color:#475569;">
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;">Azienda</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;">Fase</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;">Sensibility</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;">Kg min</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;">Scadenza</th>
          </tr>
        </thead>
        <tbody>${dueRows}</tbody>
      </table>

      <h2 style="font-size:16px;margin:22px 0 10px;">📊 Recap pipeline per fase</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tbody>${recapRows}</tbody>
      </table>

      <p style="margin-top:22px;color:#94a3b8;font-size:12px;">Email automatica generata da Cafezal CRM.</p>
    </div>
  </div>`;
}
