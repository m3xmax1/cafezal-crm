import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';

const kg = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg`;
const eur = (v) => `€ ${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const meseLabel = (m) => {
  const [y, mm] = m.split('-');
  return `${MESI[Number(mm) - 1]} ${y.slice(2)}`;
};
const STATO_LABEL = {
  ricevuto: 'Ricevuto', in_lavorazione: 'In lavorazione', pronto: 'Pronto',
  spedito: 'Spedito', problema: 'Problema', archiviato: 'Archiviato',
};

function BarRow({ label, value, max, fmt, color = 'bg-blue-500' }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-40 shrink-0 truncate text-sm text-slate-600" title={label}>{label}</div>
      <div className="flex-1">
        <div className={`h-5 rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-24 shrink-0 text-right text-sm font-semibold text-slate-700">{fmt(value)}</div>
    </div>
  );
}

export default function StatisticheTorrefazione() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.stats
      .torrefazione()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout><div className="grid place-items-center py-20 text-slate-400">Caricamento…</div></Layout>;
  if (error) return <Layout><div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div></Layout>;

  const t = data.totali;
  const maxMese = Math.max(1, ...data.months.map((m) => m.kg));
  const maxProd = Math.max(1, ...data.topProdotti.map((p) => p.kg));
  const maxDest = Math.max(1, ...data.topDestinazioni.map((d) => d.kg));
  const splitTot = data.split.retail.kg + data.split.b2b.kg || 1;
  const card = 'rounded-xl border border-slate-200 bg-white px-4 py-3';

  return (
    <Layout>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Statistiche torrefazione</h2>
        <p className="text-sm text-slate-500">Andamento ordini, produzione e destinazioni.</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Ordini</div><div className="text-2xl font-bold text-slate-900">{t.ordini}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Kg totali</div><div className="text-2xl font-bold text-emerald-600">{kg(t.kg)}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Valore</div><div className="text-2xl font-bold text-slate-900">{eur(t.valore)}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Attivi</div><div className="text-2xl font-bold text-blue-600">{t.attivi}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Problemi</div><div className="text-2xl font-bold text-rose-600">{t.problemi}</div></div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Kg prodotti per mese</h3>
          {data.months.length === 0 ? <p className="text-sm text-slate-400">Nessun dato.</p> : (
            <div className="flex h-48 items-end gap-1.5">
              {data.months.map((m) => (
                <div key={m.mese} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-end justify-center" style={{ height: '160px' }}>
                    <div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(2, (m.kg / maxMese) * 100)}%` }} title={kg(m.kg)} />
                  </div>
                  <span className="text-[10px] text-slate-400">{meseLabel(m.mese)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Retail vs B2B</h3>
          <div className="mb-3 flex h-6 overflow-hidden rounded-lg">
            <div className="bg-blue-500" style={{ width: `${(data.split.retail.kg / splitTot) * 100}%` }} title={`Retail ${kg(data.split.retail.kg)}`} />
            <div className="bg-indigo-500" style={{ width: `${(data.split.b2b.kg / splitTot) * 100}%` }} title={`B2B ${kg(data.split.b2b.kg)}`} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-600">● Retail — {data.split.retail.n} ord · {kg(data.split.retail.kg)}</span>
            <span className="text-indigo-600">B2B — {data.split.b2b.n} ord · {kg(data.split.b2b.kg)} ●</span>
          </div>
          <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">Per stato</h4>
          <div className="space-y-1">
            {Object.entries(data.byStato).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
              <div key={s} className="flex justify-between text-sm">
                <span className="text-slate-600">{STATO_LABEL[s] || s}</span>
                <span className="font-semibold text-slate-700">{n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Top caffè (kg)</h3>
          {data.topProdotti.map((p) => (
            <BarRow key={p.nome} label={p.nome} value={p.kg} max={maxProd} fmt={kg} color="bg-amber-500" />
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Top destinazioni (kg)</h3>
          {data.topDestinazioni.map((d) => (
            <BarRow key={d.nome} label={d.nome} value={d.kg} max={maxDest} fmt={kg} color="bg-violet-500" />
          ))}
        </section>
      </div>
    </Layout>
  );
}
