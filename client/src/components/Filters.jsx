import { COMMERCIALI, FASI, SENSIBILITY, CATEGORIE } from '../lib/constants.js';

export default function Filters({ value, onChange, showCommerciale }) {
  const set = (k, v) => onChange({ ...value, [k]: v || undefined });
  const sel =
    'h-9 shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const hasFilters = value.commerciale || value.categoria || value.fase || value.sensibility;

  return (
    <div className="flex flex-nowrap items-center gap-2 sm:flex-wrap">
      {showCommerciale && (
        <select className={sel} value={value.commerciale || ''} onChange={(e) => set('commerciale', e.target.value)}>
          <option value="">Tutti i commerciali</option>
          {COMMERCIALI.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      <select className={sel} value={value.categoria || ''} onChange={(e) => set('categoria', e.target.value)}>
        <option value="">Tutte le categorie</option>
        {CATEGORIE.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select className={sel} value={value.fase || ''} onChange={(e) => set('fase', e.target.value)}>
        <option value="">Tutte le fasi</option>
        {FASI.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <select className={sel} value={value.sensibility || ''} onChange={(e) => set('sensibility', e.target.value)}>
        <option value="">Tutte le sensibility</option>
        {SENSIBILITY.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => onChange({})}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          Reset
        </button>
      )}
    </div>
  );
}
