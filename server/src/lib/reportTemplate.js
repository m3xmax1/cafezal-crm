import { FASI } from './constants.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statCard(label, value, color) {
  return `
    <td style="padding:6px;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 12px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:${color};line-height:1.1;">${value}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-top:4px;">${escapeHtml(label)}</div>
      </div>
    </td>`;
}

/**
 * Monthly management report email (inline CSS for email-client compatibility).
 * @param {object} s stats produced by report.service.runMonthlyReport
 */
export function buildMonthlyReportEmail(s) {
  const cards1 = [
    statCard('Totale lead', s.total, '#0f172a'),
    statCard('In pool', s.pool, '#0891b2'),
    statCard('Assegnati', s.assigned, '#2563eb'),
  ].join('');
  const cards2 = [
    statCard('Attivi', s.open, '#7c3aed'),
    statCard('Chiusi', s.won, '#16a34a'),
    statCard('K.O.', s.lost, '#dc2626'),
  ].join('');

  const commRows = s.perCommercial
    .map(
      (c) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;font-weight:600;">${escapeHtml(c.commerciale)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;">${c.total}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;color:#7c3aed;">${c.open}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;color:#16a34a;font-weight:600;">${c.won}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;color:#dc2626;">${c.lost}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;">${c.worked}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;font-weight:600;">${c.winRate === null ? '—' : c.winRate + '%'}</td>
      </tr>`,
    )
    .join('');

  const phaseRows = FASI.map(
    (f) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(f)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${s.byPhase[f] || 0}</td>
      </tr>`,
  ).join('');

  const catRows = s.topCategories
    .map(
      ([name, n]) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(name)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${n}</td>
      </tr>`,
    )
    .join('');

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;">
    <div style="background:#0f172a;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;">📊 Cafezal CRM — Report Mensile</h1>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:14px;">Riepilogo attività commerciale — <strong style="color:#fff;text-transform:capitalize;">${escapeHtml(s.monthLabel)}</strong></p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:22px 26px;border-radius:0 0 12px 12px;background:#ffffff;">

      <h2 style="font-size:15px;margin:0 0 8px;color:#334155;">Quadro generale</h2>
      <table style="width:100%;border-collapse:collapse;"><tr>${cards1}</tr></table>
      <table style="width:100%;border-collapse:collapse;"><tr>${cards2}</tr></table>

      <h2 style="font-size:15px;margin:22px 0 8px;color:#334155;">Valore (€)</h2>
      <table style="width:100%;border-collapse:collapse;"><tr>
        ${statCard('Pipeline aperta', `€ ${(s.pipelineValue || 0).toLocaleString('it-IT')}`, '#2563eb')}
        ${statCard('Forecast ponderato', `€ ${(s.weightedForecast || 0).toLocaleString('it-IT')}`, '#7c3aed')}
        ${statCard('Vinto', `€ ${(s.wonValue || 0).toLocaleString('it-IT')}`, '#16a34a')}
      </tr></table>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">Forecast ponderato = valore stimato × probabilità della fase.</p>

      <p style="margin:16px 0 0;padding:12px 14px;background:#eff6ff;border:1px solid #dbeafe;border-radius:10px;font-size:14px;color:#1e3a8a;">
        🗓️ <strong>${s.updatedThisMonth}</strong> lead aggiornati/lavorati nel mese di ${escapeHtml(s.monthLabel)}.
        Restano <strong>${s.pool}</strong> lead nel pool ancora da prendere in carico.
      </p>

      <h2 style="font-size:15px;margin:24px 0 10px;color:#334155;">Per commerciale</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="text-align:left;color:#64748b;">
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;">Commerciale</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right;">Assegnati</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right;">Attivi</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right;">Chiusi</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right;">K.O.</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right;">Lavorati nel mese</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right;">Win&nbsp;rate</th>
          </tr>
        </thead>
        <tbody>${commRows}</tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:24px;">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:10px;">
            <h2 style="font-size:15px;margin:0 0 10px;color:#334155;">Pipeline per fase</h2>
            <table style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${phaseRows}</tbody></table>
          </td>
          <td style="vertical-align:top;width:50%;padding-left:10px;">
            <h2 style="font-size:15px;margin:0 0 10px;color:#334155;">Top categorie</h2>
            <table style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${catRows}</tbody></table>
          </td>
        </tr>
      </table>

      <p style="margin-top:24px;color:#94a3b8;font-size:12px;">Report automatico generato da Cafezal CRM il 1° del mese. Win rate = chiusi / (chiusi + K.O.).</p>
    </div>
  </div>`;
}
