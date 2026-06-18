// Email templates for the roastery (torrefazione) jobs:
//  - weekly Monday recap (what to produce/ship, by destination + aggregated)
//  - Friday store reminder (place your weekly order)
// Inline CSS for email-client compatibility (same approach as emailTemplate.js).

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y) return s;
  return `${day}/${m}/${y}`;
}

const kg = (v) =>
  `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`;

const WEB = 'https://cafezal-crm-web.vercel.app';

function chip(label, n, bg, fg) {
  return `<span style="display:inline-block;background:${bg};color:${fg};border-radius:9999px;padding:3px 10px;font-size:13px;font-weight:600;margin-right:6px;">${n} ${escapeHtml(label)}</span>`;
}

function sectionTitle(emoji, text, color) {
  return `<h2 style="font-size:15px;margin:22px 0 8px;color:${color};">${emoji} ${escapeHtml(text)}</h2>`;
}

/**
 * Monday recap for the roastery.
 * @param {{today:string, produzione:Array<[string,{pezzi:number,kg:number}]>,
 *          destinazioni:Array<{nome:string, origine:string, ordini:Array}>,
 *          problemi:Array, kgTot:number, ordiniAttivi:number}} p
 */
export function buildWeeklyRecapEmail({
  today,
  produzione = [],
  destinazioni = [],
  problemi = [],
  kgTot = 0,
  ordiniAttivi = 0,
}) {
  const summary = `
    <div style="margin:0 0 4px;">
      ${chip('ordini attivi', ordiniAttivi, '#dbeafe', '#1d4ed8')}
      ${chip('destinazioni', destinazioni.length, '#f1f5f9', '#475569')}
      ${chip('da produrre', kg(kgTot), '#dcfce7', '#15803d')}
      ${problemi.length ? chip('problemi', problemi.length, '#fee2e2', '#b91c1c') : ''}
    </div>`;

  const problemiBlock = problemi.length
    ? sectionTitle('⚠️', 'Ordini con problemi', '#b91c1c') +
      `<table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${problemi
        .map(
          (o) => `
        <tr>
          <td style="padding:9px 10px;border-bottom:1px solid #fee2e2;">
            <div style="font-weight:600;color:#0f172a;">${escapeHtml(o.cliente_nome || o.negozi?.nome || '—')} <span style="color:#94a3b8;font-weight:400;">#${o.id}</span></div>
            ${o.note ? `<div style="color:#b91c1c;font-size:13px;">${escapeHtml(o.note)}</div>` : ''}
          </td>
          <td style="padding:9px 10px;border-bottom:1px solid #fee2e2;text-align:right;white-space:nowrap;color:#94a3b8;font-size:12px;">${escapeHtml(o.origine || '')}</td>
        </tr>`,
        )
        .join('')}</tbody></table>`
    : '';

  const produzioneBlock = produzione.length
    ? sectionTitle('🔥', 'Da produrre (aggregato)', '#0f172a') +
      `<table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="text-align:left;color:#94a3b8;font-size:12px;text-transform:uppercase;">
          <th style="padding:6px 10px;">Caffè / formato</th>
          <th style="padding:6px 10px;text-align:right;">Pezzi</th>
          <th style="padding:6px 10px;text-align:right;">Kg</th>
        </tr></thead>
        <tbody>${produzione
          .map(
            ([nome, v]) => `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#334155;">${escapeHtml(nome)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#64748b;">${v.pezzi}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;color:#0f172a;">${kg(v.kg)}</td>
          </tr>`,
          )
          .join('')}</tbody></table>`
    : '<p style="color:#16a34a;font-size:14px;">Nessun ordine attivo da produrre 🎉</p>';

  const destBlock = destinazioni.length
    ? sectionTitle('📦', 'Per destinazione', '#334155') +
      destinazioni
        .map(
          (d) => `
        <div style="margin:0 0 10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;">
          <div style="display:flex;justify-content:space-between;">
            <strong style="color:#0f172a;">${escapeHtml(d.nome)}</strong>
            <span style="color:#94a3b8;font-size:12px;">${d.ordini.length} ord. · ${kg(d.ordini.reduce((s, o) => s + Number(o.peso_totale_kg || 0), 0))}</span>
          </div>
          ${d.ordini
            .map(
              (o) =>
                `<div style="margin-top:4px;color:#475569;font-size:13px;">#${o.id} · consegna ${fmtDate(o.data_consegna)} · ${escapeHtml(o.stato)}<br><span style="color:#64748b;font-size:12px;">${escapeHtml((o.ordini_righe || []).map((r) => `${r.nome_caffe} ×${r.quantita}`).join(' · '))}</span></div>`,
            )
            .join('')}
        </div>`,
        )
        .join('')
    : '';

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;">🔥 Torrefazione — Recap della settimana</h1>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:14px;">Settimana del ${fmtDate(today)} · cosa produrre e spedire.</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 12px 12px;background:#ffffff;">
      ${summary}
      ${problemiBlock}
      ${produzioneBlock}
      ${destBlock}
      <p style="margin-top:22px;">
        <a href="${WEB}/produzione" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px;">Apri il foglio di produzione</a>
      </p>
      <p style="margin-top:16px;color:#94a3b8;font-size:12px;">Email automatica generata da Cafezal CRM ogni lunedì.</p>
    </div>
  </div>`;
}

/**
 * Friday reminder to a store: place your weekly order.
 * @param {{negozio:string, today:string}} p
 */
export function buildStoreReminderEmail({ negozio, today }) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;">☕ Promemoria ordine — ${escapeHtml(negozio)}</h1>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:14px;">${fmtDate(today)}</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:22px 24px;border-radius:0 0 12px 12px;background:#ffffff;">
      <p style="font-size:15px;color:#334155;margin:0 0 14px;">Ciao <strong>${escapeHtml(negozio)}</strong> 👋</p>
      <p style="font-size:15px;color:#334155;margin:0 0 16px;">È il momento di inviare l'<strong>ordine settimanale</strong> alla torrefazione. Controlla le scorte e invia la richiesta dal CRM: la torrefazione lo preparerà per la consegna.</p>
      <p style="margin:0 0 18px;">
        <a href="${WEB}/ordina" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px;">Invia il tuo ordine</a>
      </p>
      <p style="color:#64748b;font-size:13px;margin:0;">Suggerimento: invia entro fine giornata così la torrefazione organizza la produzione per la settimana.</p>
      <p style="margin-top:20px;color:#94a3b8;font-size:12px;">Email automatica generata da Cafezal CRM ogni venerdì.</p>
    </div>
  </div>`;
}
