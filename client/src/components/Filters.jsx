import { COMMERCIALI, FASI, SENSIBILITY, CATEGORIE } from '../lib/constants.js';

export default function Filters({ value, onChange, showCommerciale }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const sel =
    'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500';

  const hasFilters = value.commerciale || value.categoria || value.fase || value.sensibility;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showCommerciale && (
        <select
          className={sel}
          value={value.commerciale || ''}
          onChange={(e) => set('commerciale', e.target.value)}
        >
          <option value="">Tutti i commerciali</option>
          {COMMERCIALI.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      <select
        className={sel}
        value={value.categoria || ''}
        onChange={(e) => set('categoria', e.target.value)}
      >
        <option value="">Tutte le categorie</option>
        {CATEGORIE.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        className={sel}
        value={value.fase || ''}
        onChange={(e) => set('fase', e.target.value)}
      >
        <option value="">Tutte le fasi</option>
        {FASI.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <select
        className={sel}
        value={value.sensibility || ''}
        onChange={(e) => set('sensibility', e.target.value)}
      >
        <option value="">Tutte le sensibility</option>
        {SENSIBILITY.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => onChange({})}
          className="text-sm text-slate-500 underline hover:text-slate-700"
        >
          Reset
        </button>
      )}
    </div>
  );
}
