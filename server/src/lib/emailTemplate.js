import { FASI } from './constants.js';

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

function daysBetween(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00:00Z`);
  const b = new Date(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function relLabel(followupISO, todayISO) {
  const d = daysBetween(todayISO, followupISO);
  if (d < 0) return d === -1 ? 'ieri' : `${Math.abs(d)} g fa`;
  if (d === 0) return 'oggi';
  if (d === 1) return 'domani';
  return `tra ${d} g`;
}

/** A table of follow-up rows: azienda · prossima azione · contatto · data. */
function followupTable(rows, todayISO, accent) {
  const body = rows
    .map(
      (o) => `
      <tr>
        <td style="padding:9px 10px;border-bottom:1px solid #eef2f7;">
          <div style="font-weight:600;color:#0f172a;">${escapeHtml(o.azienda)}</div>
          ${o.prossima_azione ? `<div style="color:#475569;font-size:13px;">${escapeHtml(o.prossima_azione)}</div>` : ''}
          ${
            o.referente || o.telefono
              ? `<div style="color:#94a3b8;font-size:12px;">${escapeHtml(o.referente || '')}${o.referente && o.telefono ? ' · ' : ''}${escapeHtml(o.telefono || '')}</div>`
              : ''
          }
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #eef2f7;text-align:right;white-space:nowrap;">
          <div style="font-weight:600;color:${accent};">${relLabel(o.data_prossimo_followup, todayISO)}</div>
          <div style="color:#94a3b8;font-size:12px;">${fmtDate(o.data_prossimo_followup)}</div>
        </td>
      </tr>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${body}</tbody></table>`;
}

function sectionTitle(emoji, text, color) {
  return `<h2 style="font-size:15px;margin:22px 0 8px;color:${color};">${emoji} ${escapeHtml(text)}</h2>`;
}

/**
 * Guided daily recap email (inline CSS for email-client compatibility).
 * @param {{commerciale:string, today:string, daysAhead:number,
 *          overdue:Array, dueToday:Array, upcoming:Array, daPianificare:number, recap:Object}} p
 */
export function buildReminderEmail({
  commerciale,
  today,
  daysAhead = 3,
  overdue = [],
  dueToday = [],
  upcoming = [],
  daPianificare = 0,
  recap = {},
  problemiTorre = [],
}) {
  const chip = (label, n, bg, fg) =>
    `<span style="display:inline-block;background:${bg};color:${fg};border-radius:9999px;padding:3px 10px;font-size:13px;font-weight:600;margin-right:6px;">${n} ${label}</span>`;

  const summary = `
    <div style="margin:0 0 4px;">
      ${overdue.length ? chip('in ritardo', overdue.length, '#fee2e2', '#b91c1c') : ''}
      ${dueToday.length ? chip('oggi', dueToday.length, '#fef3c7', '#b45309') : ''}
      ${upcoming.length ? chip(`entro ${daysAhead}g`, upcoming.length, '#dbeafe', '#1d4ed8') : ''}
      ${daPianificare ? chip('da pianificare', daPianificare, '#f1f5f9', '#475569') : ''}
      ${problemiTorre.length ? chip('problemi ordine', problemiTorre.length, '#fee2e2', '#b91c1c') : ''}
    </div>`;

  const problemiBlock = problemiTorre.length
    ? sectionTitle('📦', 'Problemi su ordini in torrefazione', '#b91c1c') +
      `<table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${problemiTorre
        .map(
          (o) => `
        <tr>
          <td style="padding:9px 10px;border-bottom:1px solid #fee2e2;">
            <div style="font-weight:600;color:#0f172a;">${escapeHtml(o.cliente_nome || '—')} <span style="color:#94a3b8;font-weight:400;">#${o.id}</span></div>
            ${o.note ? `<div style="color:#b91c1c;font-size:13px;">${escapeHtml(o.note)}</div>` : ''}
          </td>
          <td style="padding:9px 10px;border-bottom:1px solid #fee2e2;text-align:right;white-space:nowrap;color:#94a3b8;font-size:12px;">${o.data_consegna ? fmtDate(o.data_consegna) : ''}</td>
        </tr>`,
        )
        .join('')}</tbody></table>`
    : '';

  const overdueBlock = overdue.length
    ? sectionTitle('🔴', 'Follow-up in ritardo', '#b91c1c') + followupTable(overdue, today, '#b91c1c')
    : '';
  const todayBlock = dueToday.length
    ? sectionTitle('🟡', 'Da fare oggi', '#b45309') + followupTable(dueToday, today, '#b45309')
    : '';
  const upcomingBlock = upcoming.length
    ? sectionTitle('🔵', `In arrivo (prossimi ${daysAhead} giorni)`, '#1d4ed8') + followupTable(upcoming, today, '#1d4ed8')
    : '';
  const planBlock = daPianificare
    ? `<div style="margin-top:18px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#334155;">
         ⚪ Hai <strong>${daPianificare}</strong> lead presi in carico <strong>senza una prossima azione</strong>. Apri il CRM e fissa il prossimo passo per non perderli di vista.
       </div>`
    : '';

  const recapRows = FASI.map(
    (f) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(f)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${recap[f] || 0}</td>
      </tr>`,
  ).join('');

  const allClear =
    !overdue.length && !dueToday.length && !upcoming.length && !daPianificare && !problemiTorre.length
      ? `<p style="color:#16a34a;font-size:14px;">Tutto in ordine: nessun follow-up in scadenza 🎉</p>`
      : '';

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;">☕ Cafezal CRM — La tua giornata</h1>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:14px;">Ciao ${escapeHtml(commerciale)}, ecco i follow-up del ${fmtDate(today)}.</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 12px 12px;background:#ffffff;">
      ${summary}
      ${allClear}
      ${problemiBlock}
      ${overdueBlock}
      ${todayBlock}
      ${upcomingBlock}
      ${planBlock}

      <h2 style="font-size:15px;margin:24px 0 8px;color:#334155;">📊 Pipeline per fase</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${recapRows}</tbody></table>

      <p style="margin-top:22px;color:#94a3b8;font-size:12px;">Email automatica generata da Cafezal CRM.</p>
    </div>
  </div>`;
}
