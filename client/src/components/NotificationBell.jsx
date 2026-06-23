import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { todayISO } from '../lib/constants.js';

const daysUntil = (s) => (s ? Math.round((new Date(s).getTime() - Date.now()) / 86400000) : null);

// Cache condivisa (60s) così la campanella non rifà le chiamate ad ogni navigazione.
let _cache = null;
let _cacheAt = 0;
const TONE = {
  rose: 'text-rose-600', amber: 'text-amber-600', blue: 'text-blue-600', cyan: 'text-cyan-600', slate: 'text-slate-500',
};

export default function NotificationBell() {
  const { isAdmin, isTorrefazione, store, commerciale } = useAuth();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ followups: [], clienti: [], eventi: [], ordini: [] });
  const ref = useRef(null);
  const isSales = !store && (!!commerciale || isAdmin) && !isTorrefazione;
  const isRoastery = isTorrefazione || isAdmin;

  const load = useCallback((force = false) => {
    if (store) return;
    if (!force && _cache && Date.now() - _cacheAt < 60000) { setD(_cache); return; }
    const tasks = [];
    if (isSales || isAdmin) {
      tasks.push(
        api.agenda().then((r) => ({ followups: r?.followups || [] })).catch(() => ({})),
        api.clienti.list().then((r) => ({ clienti: r || [] })).catch(() => ({})),
        api.eventi.list().then((r) => ({ eventi: r || [] })).catch(() => ({})),
      );
    }
    if (isRoastery || isSales) tasks.push(api.ordini.list().then((r) => ({ ordini: r || [] })).catch(() => ({})));
    Promise.all(tasks).then((parts) => {
      const merged = Object.assign({ followups: [], clienti: [], eventi: [], ordini: [] }, ...parts);
      _cache = merged;
      _cacheAt = Date.now();
      setD(merged);
    });
  }, [store, isSales, isAdmin, isRoastery]);

  useEffect(() => { load(); }, [load]);

  // Rinfresca (bypassando la cache) ad ogni mutazione dei dati, così i toggle
  // tipo "permessi inviati" spariscono subito senza aspettare i 60s di cache.
  useEffect(() => {
    const onChange = () => load(true);
    window.addEventListener('cafezal:data-changed', onChange);
    return () => window.removeEventListener('cafezal:data-changed', onChange);
  }, [load]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const notes = useMemo(() => {
    const out = [];
    const today = todayISO();
    if (isSales || isAdmin) {
      const fu = d.followups || [];
      const overdue = fu.filter((f) => (f.data_prossimo_followup || '') < today && f.data_prossimo_followup).length;
      const oggi = fu.filter((f) => f.data_prossimo_followup === today).length;
      if (overdue) out.push({ icon: '🔴', text: `${overdue} follow-up in ritardo`, to: '/agenda', tone: 'rose' });
      if (oggi) out.push({ icon: '🟡', text: `${oggi} follow-up oggi`, to: '/agenda', tone: 'amber' });

      const attivi = (d.clienti || []).filter((c) => c.attivo !== false);
      const scaduti = attivi.filter((c) => { const x = daysUntil(c.scadenza_contratto); return x != null && x < 0; }).length;
      const inScad = attivi.filter((c) => { const x = daysUntil(c.scadenza_contratto); return x != null && x >= 0 && x <= 90; }).length;
      const sottoMin = attivi.filter((c) => { const m = Number(c.ordine_minimo_kg) || 0; return m > 0 && (Number(c.stats?.kg90) || 0) / 3 < m * 0.8; }).length;
      if (scaduti) out.push({ icon: '📄', text: `${scaduti} contratti scaduti`, to: '/clienti', tone: 'rose' });
      if (inScad) out.push({ icon: '⏰', text: `${inScad} contratti in scadenza ≤90g`, to: '/clienti', tone: 'amber' });
      if (sottoMin) out.push({ icon: '📉', text: `${sottoMin} clienti sotto minimo`, to: '/clienti', tone: 'rose' });

      const ev = (d.eventi || []).filter((e) => e.attivo !== false);
      const permessi = ev.filter((e) => e.status === 'organizzazione' && (!e.permessi_status || e.permessi_status === 'da_chiedere')).length;
      const prossimiEv = ev.filter((e) => { const x = daysUntil(e.data_evento); return x != null && x >= 0 && x <= 7; }).length;
      if (permessi) out.push({ icon: '🎪', text: `${permessi} eventi: permessi da chiedere`, to: '/eventi', tone: 'amber' });
      if (prossimiEv) out.push({ icon: '📅', text: `${prossimiEv} eventi nei prossimi 7g`, to: '/eventi', tone: 'cyan' });
    }
    // Commerciale: i suoi ordini B2B spediti (in arrivo dalla torrefazione).
    if (commerciale && !isAdmin) {
      const spediti = (d.ordini || []).filter((o) => o.stato === 'spedito').length;
      if (spediti) out.push({ icon: '🚚', text: `${spediti} ordini spediti (in arrivo)`, to: '/ordini', tone: 'blue' });
    }
    if (isRoastery) {
      const ord = d.ordini || [];
      const problema = ord.filter((o) => o.stato === 'problema').length;
      const ricevuti = ord.filter((o) => o.stato === 'ricevuto').length;
      if (problema) out.push({ icon: '⚠️', text: `${problema} ordini con problemi`, to: '/ordini', tone: 'rose' });
      if (ricevuti) out.push({ icon: '📥', text: `${ricevuti} nuovi ordini ricevuti`, to: '/ordini', tone: 'blue' });
    }
    return out;
  }, [d, isSales, isAdmin, isRoastery, commerciale]);

  if (store) return null;
  const count = notes.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { if (!open) load(true); setOpen((v) => !v); }}
        title="Notifiche"
        aria-label="Notifiche"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{count}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">Notifiche</div>
          {count === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-400">Tutto sotto controllo 🎉</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notes.map((n, i) => (
                <Link key={i} to={n.to} onClick={() => setOpen(false)} className="flex items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-sm transition-colors last:border-0 hover:bg-slate-50">
                  <span className="text-base">{n.icon}</span>
                  <span className={`flex-1 font-medium ${TONE[n.tone] || 'text-slate-700'}`}>{n.text}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-300"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
