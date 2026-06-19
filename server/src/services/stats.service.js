import { db } from '../config/supabase.js';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Roastery (torrefazione) statistics — visible to torrefazione + admin. */
export async function roasteryStats(user) {
  if (!user.isAdmin && !user.isTorrefazione) throw httpError('Non autorizzato', 403);

  // Pull all orders with their lines (orders count is small; lines come embedded).
  const all = [];
  for (let p = 0; p < 10; p++) {
    const from = p * 1000;
    const { data, error } = await db
      .from('ordini')
      .select('id, origine, stato, cliente_nome, data_ordine, peso_totale_kg, totale, negozi(nome), ordini_righe(nome_caffe, quantita, peso_kg)')
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < 1000) break;
  }

  const byStato = {};
  const byMonth = {};
  const prodKg = {};
  const destKg = {};
  const split = { retail: { n: 0, kg: 0 }, b2b: { n: 0, kg: 0 } };
  let kgTot = 0;
  let valoreTot = 0;

  for (const o of all) {
    byStato[o.stato] = (byStato[o.stato] || 0) + 1;
    const kg = Number(o.peso_totale_kg) || 0;
    kgTot += kg;
    valoreTot += Number(o.totale) || 0;
    const orig = o.origine === 'b2b' ? 'b2b' : 'retail';
    split[orig].n += 1;
    split[orig].kg += kg;

    if (o.data_ordine) {
      const m = String(o.data_ordine).slice(0, 7); // YYYY-MM
      if (!byMonth[m]) byMonth[m] = { ordini: 0, kg: 0 };
      byMonth[m].ordini += 1;
      byMonth[m].kg += kg;
    }
    const dest = o.cliente_nome || o.negozi?.nome || '—';
    destKg[dest] = (destKg[dest] || 0) + kg;

    for (const r of o.ordini_righe || []) {
      const k = r.nome_caffe || '—';
      prodKg[k] = (prodKg[k] || 0) + (Number(r.quantita) || 0) * (Number(r.peso_kg) || 0);
    }
  }

  const months = Object.keys(byMonth).sort().slice(-12).map((m) => ({ mese: m, ...byMonth[m], kg: r2(byMonth[m].kg) }));
  const topProdotti = Object.entries(prodKg).map(([nome, kg]) => ({ nome, kg: r2(kg) })).sort((a, b) => b.kg - a.kg).slice(0, 12);
  const topDestinazioni = Object.entries(destKg).map(([nome, kg]) => ({ nome, kg: r2(kg) })).sort((a, b) => b.kg - a.kg).slice(0, 12);

  return {
    totali: {
      ordini: all.length,
      kg: r2(kgTot),
      valore: r2(valoreTot),
      attivi: (byStato.ricevuto || 0) + (byStato.in_lavorazione || 0) + (byStato.pronto || 0) + (byStato.problema || 0),
      problemi: byStato.problema || 0,
    },
    byStato,
    split: { retail: { n: split.retail.n, kg: r2(split.retail.kg) }, b2b: { n: split.b2b.n, kg: r2(split.b2b.kg) } },
    months,
    topProdotti,
    topDestinazioni,
  };
}
