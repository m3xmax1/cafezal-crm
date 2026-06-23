import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { todayISO, addDaysISO, fmtDate } from '../lib/constants.js';

const lastData = (arr) => [...(arr || [])].map((a) => a.data).filter(Boolean).sort().pop();

export default function CaffeAgenda() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.caffeVerde.list().then((d) => setItems(d || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const { buckets, totale } = useMemo(() => {
    const today = todayISO();
    const week = addDaysISO(today, 7);
    const rows = items
      .map((c) => {
        const next = (c.caffe_difluid || []).map((a) => a.prossima_data).filter(Boolean).sort().pop();
        return next ? { c, date: next, ultima: lastData(c.caffe_difluid) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));
    const b = { scadute: [], oggi: [], settimana: [], dopo: [] };
    for (const r of rows) {
      if (r.date < today) b.scadute.push(r);
      else if (r.date === today) b.oggi.push(r);
      else if (r.date <= week) b.settimana.push(r);
      else b.dopo.push(r);
    }
    return { buckets: b, totale: rows.length };
  }, [items]);

  const groups = [
    { key: 'scadute', label: 'Scadute', dot: 'bg-rose-500', text: 'text-rose-700' },
    { key: 'oggi', label: 'Oggi', dot: 'bg-amber-500', text: 'text-amber-700' },
    { key: 'settimana', label: 'Prossimi 7 giorni', dot: 'bg-blue-500', text: 'text-blue-700' },
    { key: 'dopo', label: 'Più avanti', dot: 'bg-slate-400', text: 'text-slate-600' },
  ];

  return (
    <Layout>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Agenda rilevazioni</h2>
        <p className="text-sm text-slate-500">Le prossime analisi DiFluid programmate sui caffè verdi.</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : totale === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          Nessuna rilevazione programmata. Imposta la “prossima” quando registri un’analisi DiFluid.
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-5">
          {groups.map((g) => (
            buckets[g.key].length > 0 && (
              <section key={g.key}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} />
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">{g.label}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{buckets[g.key].length}</span>
                </div>
                <div className="space-y-2">
                  {buckets[g.key].map(({ c, date, ultima }) => (
                    <Link key={c.id} to={`/caffe-verde?caffe=${c.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card transition hover:border-emerald-300">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800">{c.nome}</div>
                        <div className="text-xs text-slate-400">
                          {[c.provenienza, c.processo].filter(Boolean).join(' · ') || '—'}
                          {ultima && <span> · ultima: {fmtDate(ultima)}</span>}
                        </div>
                      </div>
                      <span className={`shrink-0 text-sm font-semibold ${g.text}`}>⏰ {fmtDate(date)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )
          ))}
        </div>
      )}
    </Layout>
  );
}
