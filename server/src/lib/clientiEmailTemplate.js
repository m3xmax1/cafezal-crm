// Email mensile all'account manager: clienti sotto il minimo contrattuale / in calo.

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const kg = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg`;
const WEB = 'https://cafezal-crm-web.vercel.app';

/**
 * @param {{commerciale:string, today:string, sotto:Array<{cliente,rag_sociale,ordine_minimo_kg,kg90}>}} p
 */
export function buildClientiMensileEmail({ commerciale, today, sotto = [] }) {
  const rows = sotto
    .map((c) => {
      const min = Number(c.ordine_minimo_kg) || 0;
      const mese = (Number(c.kg90) || 0) / 3;
      const gap = Math.max(0, min - mese);
      return `
      <tr>
        <td style="padding:9px 10px;border-bottom:1px solid #fee2e2;">
          <div style="font-weight:600;color:#0f172a;">${escapeHtml(c.cliente || c.rag_sociale || '—')}</div>
          <div style="color:#94a3b8;font-size:12px;">minimo ${escapeHtml(min)} kg/mese</div>
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #fee2e2;text-align:right;white-space:nowrap;">
          <div style="font-weight:600;color:#b91c1c;">~${mese.toFixed(0)} kg/mese</div>
          <div style="color:#94a3b8;font-size:12px;">gap ${gap.toFixed(0)} kg</div>
        </td>
      </tr>`;
    })
    .join('');

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;">📉 Clienti sotto il minimo</h1>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:14px;">Ciao ${escapeHtml(commerciale)}, ecco i tuoi clienti attivi sotto la quantità contrattuale (ultimi 90 giorni).</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 12px 12px;background:#ffffff;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${rows}</tbody></table>
      <p style="margin-top:18px;">
        <a href="${WEB}/clienti" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px;">Apri i clienti attivi</a>
      </p>
      <p style="margin-top:16px;color:#94a3b8;font-size:12px;">Email automatica generata da Cafezal CRM una volta al mese.</p>
    </div>
  </div>`;
}
