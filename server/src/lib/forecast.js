// ============================================================
//  Forecast vendite giornaliere — Holt-Winters additivo con stagionalità
//  settimanale (m=7) e trend SMORZATO (phi), parametri scelti via grid-search
//  sull'errore one-step. La validità è misurata con BACKTEST rolling-origin
//  (WAPE per fascia di orizzonte) e gli intervalli usano l'RMSE empirico per
//  orizzonte. Nessuna dipendenza esterna, deterministico.
//
//  Limite dichiarato: con storico < 13 mesi la stagionalità ANNUALE non è
//  stimabile (estate/inverno). L'orizzonte "affidabile" riportato tiene conto
//  solo di ciò che il backtest può dimostrare.
// ============================================================

const M = 7; // stagionalità settimanale

// ── util date (stringhe 'YYYY-MM-DD', aritmetica in UTC) ──
export const addDays = (d, n) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** Riempie il calendario [prima..ultima] con 0 sui giorni mancanti e
 *  scarta gli zeri iniziali (locale non ancora aperto/attivo). */
export function fillDaily(rows) {
  if (!rows.length) return [];
  const map = new Map(rows.map((r) => [r.data, Number(r.valore) || 0]));
  const dates = rows.map((r) => r.data).sort();
  const out = [];
  for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDays(d, 1)) {
    out.push({ data: d, valore: map.get(d) || 0 });
  }
  while (out.length && out[0].valore === 0) out.shift();
  return out;
}

// ── Holt-Winters additivo con trend smorzato ──
function hwFit(y, { alpha, beta, gamma, phi }) {
  const n = y.length;
  const seasons = Math.floor(n / M);
  // init livello/trend sulle prime due settimane
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  let L = mean(y.slice(0, M));
  let T = (mean(y.slice(M, 2 * M)) - L) / M;
  // init stagionalità: media per fase su tutte le stagioni complete
  const S = new Array(M).fill(0);
  for (let p = 0; p < M; p += 1) {
    let acc = 0;
    for (let k = 0; k < seasons; k += 1) {
      const seg = y.slice(k * M, (k + 1) * M);
      acc += y[k * M + p] - mean(seg);
    }
    S[p] = acc / seasons;
  }
  const resid = [];
  let sse = 0;
  const warm = 2 * M;
  for (let t = 0; t < n; t += 1) {
    const p = t % M;
    const f = L + phi * T + S[p];
    const e = y[t] - f;
    if (t >= warm) { resid.push(e); sse += e * e; }
    const Lnew = alpha * (y[t] - S[p]) + (1 - alpha) * (L + phi * T);
    T = beta * (Lnew - L) + (1 - beta) * phi * T;
    S[p] = gamma * (y[t] - Lnew) + (1 - gamma) * S[p];
    L = Lnew;
  }
  return { L, T, S, lastIndex: n - 1, resid, sse, params: { alpha, beta, gamma, phi } };
}

function hwForecastPoint(fit, h) {
  // somma geometrica del trend smorzato: phi + phi^2 + … + phi^h
  const { phi } = fit.params;
  let damp = 0;
  let ph = 1;
  for (let i = 1; i <= h; i += 1) { ph *= phi; damp += ph; }
  const phase = (fit.lastIndex + h) % M;
  return fit.L + damp * fit.T + fit.S[phase];
}

const GRID = { alpha: [0.05, 0.1, 0.2, 0.35, 0.5], beta: [0.01, 0.05, 0.1], gamma: [0.05, 0.15, 0.3], phi: [0.85, 0.95, 0.98, 1] };

function bestFit(y) {
  let best = null;
  for (const alpha of GRID.alpha)
    for (const beta of GRID.beta)
      for (const gamma of GRID.gamma)
        for (const phi of GRID.phi) {
          const f = hwFit(y, { alpha, beta, gamma, phi });
          if (!best || f.sse < best.sse) best = f;
        }
  return best;
}

// ── Backtest rolling-origin: errori reali per orizzonte ──
const BUCKETS = [7, 14, 28, 42, 56, 70, 84];
const bucketOf = (h) => BUCKETS.find((b) => h <= b);

function backtest(y) {
  const n = y.length;
  const minTrain = Math.max(12 * M, Math.floor(n * 0.5));
  const acc = new Map(); // bucket -> {absErr, absAct, se, cnt, origins:Set}
  for (let origin = minTrain; origin <= n - M; origin += M) {
    const fit = bestFit(y.slice(0, origin));
    const H = Math.min(84, n - origin);
    for (let h = 1; h <= H; h += 1) {
      const b = bucketOf(h);
      const err = y[origin + h - 1] - hwForecastPoint(fit, h);
      const a = acc.get(b) || { absErr: 0, absAct: 0, se: 0, cnt: 0, origins: new Set() };
      a.absErr += Math.abs(err);
      a.absAct += Math.abs(y[origin + h - 1]);
      a.se += err * err;
      a.cnt += 1;
      a.origins.add(origin);
      acc.set(b, a);
    }
  }
  const buckets = BUCKETS.filter((b) => acc.has(b)).map((b) => {
    const a = acc.get(b);
    return {
      fino_a_giorni: b,
      wape: a.absAct > 0 ? +(a.absErr / a.absAct).toFixed(4) : null,
      rmse: +Math.sqrt(a.se / a.cnt).toFixed(2),
      campioni: a.cnt,
      origini: a.origins.size,
    };
  });
  // orizzonte "affidabile": ultima fascia consecutiva con WAPE ≤ 20% e ≥ 2 origini
  let reliable = 0;
  for (const b of buckets) {
    if (b.wape !== null && b.wape <= 0.2 && b.origini >= 2) reliable = b.fino_a_giorni;
    else break;
  }
  return { buckets, reliableDays: reliable };
}

/**
 * Forecast completo di una serie giornaliera [{data, valore}]:
 * punto + intervalli 80/95% per giorno, rollup settimanale, backtest.
 */
export function forecastSeries(rows, { horizonDays = 84 } = {}) {
  const daily = fillDaily(rows);
  const n = daily.length;
  if (n < 6 * M) return { ok: false, motivo: `storico insufficiente (${n} giorni, minimo ${6 * M})` };

  const y = daily.map((r) => r.valore);
  const fit = bestFit(y);
  const bt = backtest(y);
  const sigma1 = Math.sqrt(fit.resid.reduce((s, e) => s + e * e, 0) / Math.max(1, fit.resid.length));
  const rmseOf = (h) => {
    const b = bt.buckets.find((x) => h <= x.fino_a_giorni);
    return b ? b.rmse : sigma1 * Math.sqrt(h); // oltre il backtest: approssimazione dichiarata
  };

  const lastDate = daily[n - 1].data;
  const out = [];
  for (let h = 1; h <= horizonDays; h += 1) {
    const p = Math.max(0, hwForecastPoint(fit, h));
    const s = rmseOf(h);
    out.push({
      data: addDays(lastDate, h),
      p: +p.toFixed(2),
      lo80: +Math.max(0, p - 1.282 * s).toFixed(2),
      hi80: +(p + 1.282 * s).toFixed(2),
      lo95: +Math.max(0, p - 1.96 * s).toFixed(2),
      hi95: +(p + 1.96 * s).toFixed(2),
      affidabile: h <= bt.reliableDays,
    });
  }
  // rollup settimanale (somma; varianze sommate ≈ indipendenza, dichiarato)
  const weekly = [];
  for (let i = 0; i < out.length; i += 7) {
    const chunk = out.slice(i, i + 7);
    if (chunk.length < 7) break;
    const p = chunk.reduce((s, d) => s + d.p, 0);
    const sd = Math.sqrt(chunk.reduce((s, d, j) => s + rmseOf(i + j + 1) ** 2, 0));
    weekly.push({
      inizio: chunk[0].data,
      fine: chunk[6].data,
      p: +p.toFixed(2),
      lo95: +Math.max(0, p - 1.96 * sd).toFixed(2),
      hi95: +(p + 1.96 * sd).toFixed(2),
      affidabile: i + 7 <= bt.reliableDays,
    });
  }
  return {
    ok: true,
    giorniStorico: n,
    ultimoGiorno: lastDate,
    parametri: fit.params,
    sigma1: +sigma1.toFixed(2),
    backtest: bt,
    daily: out,
    weekly,
  };
}
