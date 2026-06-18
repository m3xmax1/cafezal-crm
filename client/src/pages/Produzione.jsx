import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';

const ATTIVI = ['ricevuto', 'in_lavorazione', 'pronto', 'problema'];
const kg = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');

function mondayOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export default function Produzione() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('tutti'); // tutti | settimana

  useEffect(() => {
    api.ordini
      .list()
      .then((d) => setOrders(d || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const scope = useMemo(() => {
    let list = orders.filter((o) => ATTIVI.includes(o.stato));
    if (period === 'settimana') {
      const lun = mondayOf(new Date());
      const dom = new Date(lun);
      dom.setDate(dom.getDate() + 7);
      list = list.filter((o) => {
        if (!o.data_consegna) return true; // senza data → la includo nella settimana
        const d = new Date(o.data_consegna);
        return d >= lun && d < dom;
      });
    }
    return list;
  }, [orders, period]);

  // Aggregato: cosa produrre (per caffè/formato).
  const produzione = useMemo(() => {
    const m = {};
    for (const o of scope) {
      for (const r of o.ordini_righe || []) {
        const k = r.nome_caffe || r.formato || '—';
        if (!m[k]) m[k] = { pezzi: 0, kg: 0 };
        m[k].pezzi += Number(r.quantita) || 0;
        m[k].kg += (Number(r.quantita) || 0) * (Number(r.peso_kg) || 0);
      }
    }
    return Object.entries(m).sort((a, b) => b[1].kg - a[1].kg);
  }, [scope]);

  const kgTot = produzione.reduce((s, [, v]) => s + v.kg, 0);
  const destinazioni = useMemo(() => {
    const g = {};
    for (const o of scope) (g[o.cliente_nome || o.negozi?.nome || '—'] ||= []).push(o);
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [scope]);

  function esportaCsv() {
    const rows = [['Caffè / formato', 'Pezzi', 'Kg']];
    for (const [nome, v] of produzione) rows.push([nome, v.pezzi, v.kg.toFixed(2)]);
    const csv = '﻿' + rows.map((r) => r.map((c) => (/[";\n]/.test(String(c)) ? `"${c}"` : c)).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `produzione-cafezal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Layout>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Produzione</h2>
          <p className="text-sm text-slate-500">Cosa produrre e spedire — esportabile e stampabile.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button onClick={() => setPeriod('tutti')} className={`rounded-md px-3 py-1 text-sm font-medium ${period === 'tutti' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Tutti gli attivi</button>
            <button onClick={() => setPeriod('settimana')} className={`rounded-md px-3 py-1 text-sm font-medium ${period === 'settimana' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Questa settimana</button>
          </div>
          <button onClick={esportaCsv} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Esporta CSV</button>
          <button onClick={() => window.print()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">Stampa</button>
        </div>
      </div>

      {error && <div className="no-print mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : (
        <div className="print-area">
          <div className="mb-3 hidden items-baseline justify-between print:flex">
            <h1 className="text-lg font-bold">Produzione torrefazione — Cafezal</h1>
            <span className="text-sm">{fmtDate(new Date())}</span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Ordini attivi</div>
              <div className="text-2xl font-bold text-slate-900">{scope.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Destinazioni</div>
              <div className="text-2xl font-bold text-blue-600">{destinazioni.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Kg da produrre</div>
              <div className="text-2xl font-bold text-emerald-600">{kg(kgTot)}</div>
            </div>
          </div>

          {scope.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
              Nessun ordine attivo da produrre{period === 'settimana' ? ' questa settimana' : ''}.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-bold text-slate-800">Da produrre (aggregato)</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-1">Caffè / formato</th>
                      <th className="py-1 text-right">Pezzi</th>
                      <th className="py-1 text-right">Kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produzione.map(([nome, v]) => (
                      <tr key={nome} className="border-t border-slate-100">
                        <td className="py-1.5 text-slate-700">{nome}</td>
                        <td className="py-1.5 text-right text-slate-500">{v.pezzi}</td>
                        <td className="py-1.5 text-right font-semibold text-slate-800">{kg(v.kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-bold text-slate-800">Per destinazione</h3>
                <div className="space-y-3">
                  {destinazioni.map(([nome, ords]) => (
                    <div key={nome} className="break-inside-avoid border-b border-slate-100 pb-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{nome}</span>
                        <span className="text-xs text-slate-400">{ords.length} ord. · {kg(ords.reduce((s, o) => s + Number(o.peso_totale_kg || 0), 0))}</span>
                      </div>
                      {ords.map((o) => (
                        <div key={o.id} className="mt-1 text-xs text-slate-500">
                          <span className="text-slate-400">#{o.id} · consegna {fmtDate(o.data_consegna)} · {o.stato}</span>
                          <div className="text-slate-600">{(o.ordini_righe || []).map((r) => `${r.nome_caffe} ×${r.quantita}`).join(' · ')}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
