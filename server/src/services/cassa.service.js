// ============================================================
//  CASSA (Tilby → vendite_giornaliere): sync, analisi, forecast, export.
//  I token Tilby (uno per locale) vivono in negozi.tilby_token (RLS default-deny,
//  li legge solo il service role). Dato SENSIBILE: lettura SOLO admin + finance.
// ============================================================

import { db } from '../config/supabase.js';
import { fetchClosedSales } from '../lib/tilby.js';
import { forecastSeries, addDays, fillDaily } from '../lib/forecast.js';
import { buildXlsx } from '../lib/xlsxWriter.js';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Lettura cassa: SOLO admin + finance (default-deny, come da policy del CRM).
export function assertCassaRead(user) {
  if (!user.isAdmin && !user.isFinance) throw httpError('Non autorizzato', 403);
}

const romeDay = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
const romeToday = () => romeDay(new Date().toISOString());
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// ── negozi con token Tilby ──
export async function getNegoziCassa() {
  const { data, error } = await db
    .from('negozi')
    .select('id, nome, tilby_token, tilby_shop_id')
    .not('tilby_token', 'is', null);
  if (error) throw error;
  if (!data?.length) {
    throw httpError('Nessun locale con token Tilby: esegui la SQL che valorizza negozi.tilby_token', 400);
  }
  return data;
}

// ── SYNC: pull vendite chiuse da Tilby → aggregato per giorno → upsert ──
export async function syncNegozioRange(negozio, from, to) {
  if (!isDate(from) || !isDate(to) || from > to) throw httpError('Intervallo date non valido', 400);
  // Finestra UTC larga (Roma è UTC+1/+2), poi bucket preciso per giorno di Roma.
  const sinceIso = `${addDays(from, -1)}T21:00:00.000Z`;
  const maxIso = `${addDays(to, 1)}T04:00:00.000Z`;

  const days = new Map();
  let shopId = negozio.tilby_shop_id || null;

  const vendite = await fetchClosedSales(negozio.tilby_token, { sinceIso, maxIso }, async (page) => {
    for (const s of page) {
      if (!s.closed_at) continue;
      const d = romeDay(s.closed_at);
      if (d < from || d > to) continue;
      if (!shopId && s.scloby_shop_id) shopId = s.scloby_shop_id;
      const a = days.get(d) || { lordo: 0, netto: 0, n: 0, pag: {}, iva: {} };
      a.lordo += s.final_amount;
      a.netto += s.final_net_amount;
      a.n += 1;
      for (const p of s.payments) a.pag[p.name] = (a.pag[p.name] || 0) + p.amount;
      // Il "change" è il resto restituito: il contante davvero incassato è al netto.
      if (s.change > 0 && a.pag.Contanti !== undefined) a.pag.Contanti -= s.change;
      // IVA per aliquota dalle righe, riscalata al totale vendita (assorbe gli
      // sconti a livello scontrino). Dato GESTIONALE, non fiscale.
      const itemsTot = s.items.reduce((t, it) => t + it.gross, 0);
      if (itemsTot > 0 && s.final_amount) {
        const scale = s.final_amount / itemsTot;
        for (const it of s.items) {
          const rate = it.vat_perc === null || it.vat_perc === undefined ? 'ND' : String(it.vat_perc);
          const g = it.gross * scale;
          const e = a.iva[rate] || { lordo: 0, imponibile: 0, imposta: 0 };
          e.lordo += g;
          if (rate !== 'ND') {
            const imp = g / (1 + Number(rate) / 100);
            e.imponibile += imp;
            e.imposta += g - imp;
          }
          a.iva[rate] = e;
        }
      }
      days.set(d, a);
    }
  });

  const rows = [...days.entries()].map(([data, a]) => ({
    negozio_id: negozio.id,
    data,
    incasso_lordo: r2(a.lordo),
    incasso_netto: r2(a.netto),
    n_scontrini: a.n,
    pagamenti: Object.fromEntries(Object.entries(a.pag).map(([k, v]) => [k, r2(v)])),
    iva: Object.fromEntries(Object.entries(a.iva).map(([k, v]) => [k, {
      lordo: r2(v.lordo), imponibile: r2(v.imponibile), imposta: r2(v.imposta),
    }])),
    scloby_shop_id: shopId,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length) {
    const { error } = await db.from('vendite_giornaliere').upsert(rows, { onConflict: 'negozio_id,data' });
    if (error) throw error;
  }
  // comodo per mappature future (Edge Function webhook ecc.)
  if (shopId && !negozio.tilby_shop_id) {
    await db.from('negozi').update({ tilby_shop_id: shopId }).eq('id', negozio.id);
  }
  return { negozio: negozio.nome, giorni: rows.length, vendite };
}

/** Sync di un intervallo per tutti i locali (usato da endpoint e backfill). */
export async function syncRange({ from, to }) {
  if (!isDate(from) || !isDate(to) || from > to) throw httpError('Intervallo date non valido', 400);
  const span = (new Date(`${to}T12:00Z`) - new Date(`${from}T12:00Z`)) / 86400000;
  if (span > 400) throw httpError('Intervallo troppo ampio (max ~13 mesi per chiamata)', 400);
  const negozi = await getNegoziCassa();
  const out = [];
  for (const n of negozi) {
    try {
      out.push(await syncNegozioRange(n, from, to));
    } catch (e) {
      out.push({ negozio: n.nome, error: e.message });
    }
  }
  return { from, to, results: out };
}

/** Sync giornaliero (scheduler/cron): ultimi `days` giorni fino a oggi. */
export async function runCassaSync({ days = 3 } = {}) {
  const to = romeToday();
  const from = addDays(to, -(Math.max(1, Math.min(days, 14)) - 1));
  return syncRange({ from, to });
}

// ── LETTURA aggregati ──
export async function getDaily({ from, to } = {}) {
  let q = db.from('vendite_giornaliere').select('*, negozi(nome)').order('data', { ascending: true });
  if (isDate(from)) q = q.gte('data', from);
  if (isDate(to)) q = q.lte('data', to);
  const { data, error } = await q.limit(20000);
  if (error) throw error;
  return (data || []).map((r) => ({ ...r, negozio_nome: r.negozi?.nome || `#${r.negozio_id}`, negozi: undefined }));
}

// ── ANALISI: KPI + pivot + profilo settimanale + forecast ──
const sum = (a) => a.reduce((s, v) => s + v, 0);
const inWin = (rows, a, b) => rows.filter((r) => r.data >= a && r.data <= b);
const lordoIn = (rows, a, b) => r2(sum(inWin(rows, a, b).map((r) => Number(r.incasso_lordo) || 0)));
const delta = (cur, prev) => (prev > 0 ? +(((cur - prev) / prev) * 100).toFixed(1) : null);
const mondayOf = (d) => {
  const t = new Date(`${d}T12:00:00Z`);
  const wd = (t.getUTCDay() + 6) % 7;
  return addDays(d, -wd);
};
const DOW_IT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const dowOf = (d) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;

export async function getAnalisi({ from = '2026-01-01' } = {}) {
  const daily = await getDaily({ from });
  if (!daily.length) return { vuoto: true, from, messaggio: 'Nessun dato: esegui prima il backfill.' };

  const lastDate = daily.reduce((m, r) => (r.data > m ? r.data : m), daily[0].data);
  const stores = [...new Set(daily.map((r) => r.negozio_nome))].sort();
  const byStore = Object.fromEntries(stores.map((s) => [s, daily.filter((r) => r.negozio_nome === s)]));

  // Finestre di confronto ancorate all'ultimo giorno con dati.
  const w = {
    l7: [addDays(lastDate, -6), lastDate],
    p7: [addDays(lastDate, -13), addDays(lastDate, -7)],
    l28: [addDays(lastDate, -27), lastDate],
    p28: [addDays(lastDate, -55), addDays(lastDate, -28)],
  };
  const monthStart = `${lastDate.slice(0, 7)}-01`;
  const prevMonthStart = `${addDays(monthStart, -1).slice(0, 7)}-01`;
  const sameDayPrevMonth = addDays(monthStart, -1).slice(0, 7) + lastDate.slice(7);

  const kpiOf = (nome, rows) => {
    const l7 = lordoIn(rows, ...w.l7);
    const p7 = lordoIn(rows, ...w.p7);
    const l28 = lordoIn(rows, ...w.l28);
    const p28 = lordoIn(rows, ...w.p28);
    const mtd = lordoIn(rows, monthStart, lastDate);
    const pmtd = lordoIn(rows, prevMonthStart, sameDayPrevMonth);
    const win28 = inWin(rows, ...w.l28);
    const sc28 = sum(win28.map((r) => Number(r.n_scontrini) || 0));
    const best = rows.reduce((b, r) => (Number(r.incasso_lordo) > Number(b?.incasso_lordo || 0) ? r : b), null);
    return {
      negozio: nome,
      l7, d7: delta(l7, p7),
      l28, d28: delta(l28, p28),
      mtd, dmtd: delta(mtd, pmtd),
      ticket28: sc28 > 0 ? r2(l28 / sc28) : null,
      scontriniG28: win28.length ? Math.round(sc28 / win28.length) : 0,
      totalePeriodo: r2(sum(rows.map((r) => Number(r.incasso_lordo) || 0))),
      giorniAttivi: rows.filter((r) => Number(r.incasso_lordo) > 0).length,
      migliorGiorno: best ? { data: best.data, lordo: r2(best.incasso_lordo) } : null,
    };
  };
  const kpi = stores.map((s) => kpiOf(s, byStore[s]));
  kpi.push(kpiOf('TOTALE', daily));

  // Pivot settimanale (lunedì) e mensile.
  const pivot = (keyFn) => {
    const map = new Map();
    for (const r of daily) {
      const k = keyFn(r.data);
      const row = map.get(k) || { periodo: k, valori: {}, totale: 0 };
      row.valori[r.negozio_nome] = r2((row.valori[r.negozio_nome] || 0) + (Number(r.incasso_lordo) || 0));
      row.totale = r2(row.totale + (Number(r.incasso_lordo) || 0));
      map.set(k, row);
    }
    return [...map.values()].sort((a, b) => (a.periodo < b.periodo ? -1 : 1));
  };
  const weekly = pivot(mondayOf);
  const monthly = pivot((d) => d.slice(0, 7));

  // Profilo giorno-settimana (media incasso per DOW, tutto il periodo).
  const dow = stores.map((s) => {
    const acc = Array.from({ length: 7 }, () => ({ tot: 0, n: 0 }));
    for (const r of byStore[s]) {
      const i = dowOf(r.data);
      acc[i].tot += Number(r.incasso_lordo) || 0;
      acc[i].n += 1;
    }
    return { negozio: s, media: acc.map((a) => (a.n ? r2(a.tot / a.n) : 0)) };
  });

  // Mix pagamenti e IVA (ultimi 28 giorni).
  const mixOf = (rows, field) => {
    const out = {};
    for (const r of inWin(rows, ...w.l28)) {
      const obj = r[field] || {};
      for (const [k, v] of Object.entries(obj)) {
        const val = field === 'iva' ? v : { lordo: v };
        const e = out[k] || { lordo: 0, imponibile: 0, imposta: 0 };
        e.lordo = r2(e.lordo + (Number(val.lordo) || 0));
        e.imponibile = r2(e.imponibile + (Number(val.imponibile) || 0));
        e.imposta = r2(e.imposta + (Number(val.imposta) || 0));
        out[k] = e;
      }
    }
    return out;
  };
  const pagamenti28 = stores.map((s) => ({ negozio: s, mix: Object.fromEntries(Object.entries(mixOf(byStore[s], 'pagamenti')).map(([k, v]) => [k, v.lordo])) }));
  const iva28 = stores.map((s) => ({ negozio: s, mix: mixOf(byStore[s], 'iva') }));

  // Forecast per store + TOTALE (serie aggregata modellata direttamente).
  const toSeries = (rows) => rows.map((r) => ({ data: r.data, valore: Number(r.incasso_lordo) || 0 }));
  const forecast = {};
  for (const s of stores) forecast[s] = forecastSeries(toSeries(byStore[s]));
  const totalByDay = new Map();
  for (const r of daily) totalByDay.set(r.data, (totalByDay.get(r.data) || 0) + (Number(r.incasso_lordo) || 0));
  forecast.TOTALE = forecastSeries([...totalByDay.entries()].map(([data, valore]) => ({ data, valore })));

  return {
    from, ultimoGiorno: lastDate, negozi: stores,
    kpi, weekly, monthly, dow, pagamenti28, iva28, forecast,
    daily: daily.map((r) => ({
      data: r.data, negozio: r.negozio_nome,
      lordo: r2(r.incasso_lordo), netto: r2(r.incasso_netto),
      scontrini: r.n_scontrini,
      ticket: r.n_scontrini > 0 ? r2(r.incasso_lordo / r.n_scontrini) : null,
      pagamenti: r.pagamenti || {}, iva: r.iva || {},
    })),
  };
}

// ── EXPORT XLSX (multi-foglio) ──
export async function buildXlsxExport({ from = '2026-01-01' } = {}) {
  const a = await getAnalisi({ from });
  if (a.vuoto) throw httpError('Nessun dato da esportare: esegui prima il backfill.', 400);
  const pct = (v) => (v === null || v === undefined ? '' : `${v}%`);

  const payNames = [...new Set(a.daily.flatMap((r) => Object.keys(r.pagamenti)))].sort();
  const vatRates = [...new Set(a.daily.flatMap((r) => Object.keys(r.iva)))].sort((x, y) => Number(x) - Number(y));

  const riepilogo = {
    name: 'Riepilogo',
    cols: [16, 13, 11, 13, 11, 13, 12, 13, 13, 14, 13],
    rows: [
      [`Cassa Cafezal — dati dal ${a.from} al ${a.ultimoGiorno}`],
      [],
      ['Locale', 'Ultimi 7gg €', 'Δ% vs prec', 'Ultimi 28gg €', 'Δ% vs prec', 'MTD €', 'Δ% mese prec', 'Ticket medio €', 'Scontrini/g', 'Totale periodo €', 'Giorni attivi'],
      ...a.kpi.map((k) => [k.negozio, k.l7, pct(k.d7), k.l28, pct(k.d28), k.mtd, pct(k.dmtd), k.ticket28, k.scontriniG28, k.totalePeriodo, k.giorniAttivi]),
    ],
  };

  const giornaliero = {
    name: 'Giornaliero',
    cols: [11, 14, 12, 12, 10, 10, ...payNames.map(() => 12), ...vatRates.flatMap(() => [13, 12])],
    rows: [
      ['Data', 'Locale', 'Lordo €', 'Netto €', 'Scontrini', 'Ticket €',
        ...payNames, ...vatRates.flatMap((r) => [`IVA ${r} imponibile`, `IVA ${r} imposta`])],
      ...a.daily.map((r) => [r.data, r.negozio, r.lordo, r.netto, r.scontrini, r.ticket,
        ...payNames.map((p) => r.pagamenti[p] ?? ''),
        ...vatRates.flatMap((v) => [r.iva[v]?.imponibile ?? '', r.iva[v]?.imposta ?? ''])]),
    ],
  };

  const pivotSheet = (name, rows, label) => ({
    name,
    cols: [13, ...a.negozi.map(() => 12), 12, 10],
    rows: [
      [label, ...a.negozi, 'TOTALE', 'Δ% tot'],
      ...rows.map((p, i) => [p.periodo, ...a.negozi.map((s) => p.valori[s] ?? ''), p.totale,
        i > 0 && rows[i - 1].totale > 0 ? `${(((p.totale - rows[i - 1].totale) / rows[i - 1].totale) * 100).toFixed(1)}%` : '']),
    ],
  });

  const dowSheet = {
    name: 'Profilo settimana',
    cols: [16, ...DOW_IT.map(() => 10)],
    rows: [['Locale (media €/g)', ...DOW_IT], ...a.dow.map((d) => [d.negozio, ...d.media])],
  };

  const pagSheet = {
    name: 'Pagamenti 28gg',
    cols: [16, ...payNames.map(() => 13)],
    rows: [['Locale', ...payNames], ...a.pagamenti28.map((p) => [p.negozio, ...payNames.map((n) => p.mix[n] ?? '')])],
  };

  const fcNames = [...a.negozi, 'TOTALE'];
  const fcDaily = { name: 'Previsioni giorno', cols: [11, 14, 12, 12, 12, 12, 12, 11], rows: [['Data', 'Locale', 'Previsione €', 'Lo 80%', 'Hi 80%', 'Lo 95%', 'Hi 95%', 'Affidabile']] };
  const fcWeekly = { name: 'Previsioni settimana', cols: [11, 11, 14, 13, 12, 12, 11], rows: [['Da', 'A', 'Locale', 'Previsione €', 'Lo 95%', 'Hi 95%', 'Affidabile']] };
  const metodo = {
    name: 'Metodo',
    cols: [110],
    rows: [
      ['MODELLO: Holt-Winters additivo, stagionalità settimanale (7g), trend smorzato (phi); parametri via grid-search sull errore one-step.'],
      ['VALIDAZIONE: backtest rolling-origin; WAPE per fascia di orizzonte; "affidabile" = fasce consecutive con WAPE ≤ 20% e ≥ 2 origini.'],
      ['INTERVALLI: RMSE empirico dal backtest per orizzonte (oltre: sigma·sqrt(h), approssimazione dichiarata); settimanali sommando varianze.'],
      ['LIMITI: storico < 13 mesi → stagionalità ANNUALE non stimabile; dati gestionali da vendite Tilby, non fiscali (Z stampante).'],
      [],
      ['Locale', 'Giorni storico', 'Orizzonte affidabile (g)', 'alpha', 'beta', 'gamma', 'phi', 'Backtest WAPE per fascia'],
    ],
  };
  for (const nome of fcNames) {
    const f = a.forecast[nome];
    if (!f?.ok) {
      metodo.rows.push([nome, f?.motivo || 'n/d']);
      continue;
    }
    for (const d of f.daily) fcDaily.rows.push([d.data, nome, d.p, d.lo80, d.hi80, d.lo95, d.hi95, d.affidabile ? 'sì' : 'no']);
    for (const wk of f.weekly) fcWeekly.rows.push([wk.inizio, wk.fine, nome, wk.p, wk.lo95, wk.hi95, wk.affidabile ? 'sì' : 'no']);
    metodo.rows.push([nome, f.giorniStorico, f.backtest.reliableDays,
      f.parametri.alpha, f.parametri.beta, f.parametri.gamma, f.parametri.phi,
      f.backtest.buckets.map((b) => `≤${b.fino_a_giorni}g: ${(b.wape * 100).toFixed(1)}%`).join(' · ')]);
  }
  metodo.cols = [16, 13, 20, 8, 8, 8, 8, 90];

  return buildXlsx([
    riepilogo, giornaliero,
    pivotSheet('Settimanale', a.weekly, 'Settimana (lun)'),
    pivotSheet('Mensile', a.monthly, 'Mese'),
    dowSheet, pagSheet, fcDaily, fcWeekly, metodo,
  ]);
}

// ── EXPORT CSV (per Google Sheets via IMPORTDATA, chiave dedicata) ──
let keyCache = { value: null, at: 0 };
export async function getExportKey() {
  if (Date.now() - keyCache.at < 60000) return keyCache.value;
  const { data, error } = await db.from('app_config').select('value').eq('key', 'cassa_export_key').maybeSingle();
  keyCache = { value: error ? null : data?.value || null, at: Date.now() };
  return keyCache.value;
}

export async function buildCsvExport({ tipo = 'giornaliero' } = {}) {
  const a = await getAnalisi({});
  if (a.vuoto) return 'nessun dato';
  const q = (v) => (v === null || v === undefined ? '' : (typeof v === 'number' ? v : `"${String(v).replace(/"/g, '""')}"`));
  if (tipo === 'settimanale') {
    const head = ['settimana_lun', ...a.negozi, 'totale'];
    const lines = a.weekly.map((p) => [p.periodo, ...a.negozi.map((s) => p.valori[s] ?? 0), p.totale]);
    return [head.join(','), ...lines.map((l) => l.map(q).join(','))].join('\n');
  }
  const head = ['data', 'negozio', 'lordo', 'netto', 'scontrini', 'ticket'];
  const lines = a.daily.map((r) => [r.data, r.negozio, r.lordo, r.netto, r.scontrini, r.ticket ?? '']);
  return [head.join(','), ...lines.map((l) => l.map(q).join(','))].join('\n');
}
