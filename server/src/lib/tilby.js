// ============================================================
//  Client minimale per l'API Tilby v2 (vendite di cassa).
//  Un token = un locale (Bearer statico emesso da Zucchetti/Tilby).
//  Risposta lista: { total, pages, per_page, page, results: [...] }.
// ============================================================

const BASE = 'https://api.tilby.com/v2';

async function tilbyGet(token, path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  // Tilby risponde 404 code 50 quando il filtro non trova nulla: non è un errore.
  if (res.status === 404 && body?.error?.code === 50) return { results: [], pages: 0, total: 0 };
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const e = new Error(`Tilby ${path}: ${msg}`);
    e.status = res.status;
    throw e;
  }
  return body;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Scarica TUTTE le vendite chiuse nell'intervallo UTC [sinceIso, maxIso),
 * paginando, e invoca onPage(salesRidotte) per ogni pagina (streaming: non
 * teniamo in memoria mesi di scontrini interi, solo i campi che servono).
 */
export async function fetchClosedSales(token, { sinceIso, maxIso }, onPage, { perPage = 100, delayMs = 120 } = {}) {
  let page = 0;
  let fetched = 0;
  for (;;) {
    const body = await tilbyGet(token, '/sales', {
      status: 'closed',
      closed_at_since: sinceIso,
      closed_at_max: maxIso,
      pagination: true,
      per_page: perPage,
      page,
      orderby_asc: 'closed_at',
    });
    const results = body?.results || [];
    if (!results.length) break;
    fetched += results.length;
    // Riduzione: teniamo solo ciò che serve all'aggregato giornaliero.
    const slim = results.map((s) => ({
      closed_at: s.closed_at,
      final_amount: Number(s.final_amount) || 0,
      final_net_amount: Number(s.final_net_amount) || 0,
      change: Number(s.change) || 0, // resto (va sottratto dal contante incassato)
      scloby_shop_id: s.scloby_shop_id || null,
      payments: (s.payments || []).map((p) => ({
        name: p.payment_method_name || 'Altro',
        amount: Number(p.amount) || 0,
      })),
      items: (s.sale_items || []).map((it) => ({
        vat_perc: it.vat_perc ?? null,
        gross: (Number(it.final_price ?? it.price) || 0) * (Number(it.quantity ?? 1) || 1),
      })),
    }));
    await onPage(slim);
    if (results.length < perPage) break;
    page += 1;
    if (delayMs) await sleep(delayMs);
  }
  return fetched;
}
