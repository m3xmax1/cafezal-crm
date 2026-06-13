import { useDroppable } from '@dnd-kit/core';
import { FASE_HEADER, FASE_ACCENT } from '../lib/constants.js';
import OpportunityCard from './OpportunityCard.jsx';

// Cap rendered cards per column for performance with large datasets.
const CAP = 60;

export default function KanbanColumn({ fase, items, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: fase });
  const shown = items.slice(0, CAP);
  const extra = items.length - shown.length;

  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="sticky top-[60px] z-10 mb-2 flex items-center justify-between rounded-lg bg-slate-50/80 px-1.5 py-1 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${FASE_ACCENT[fase] || 'bg-slate-400'}`} />
          <h3 className={`text-[13px] font-semibold uppercase tracking-wide ${FASE_HEADER[fase] || 'text-slate-700'}`}>
            {fase}
          </h3>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-[140px] flex-1 flex-col gap-2 rounded-2xl border p-2 transition-colors ${
          isOver ? 'border-blue-300 bg-blue-50' : 'border-slate-200/70 bg-slate-100/50'
        }`}
      >
        {shown.map((o) => (
          <OpportunityCard key={o.id} opp={o} onClick={() => onCardClick(o)} />
        ))}

        {items.length === 0 && (
          <div className="grid flex-1 place-items-center py-8 text-xs text-slate-400">
            Nessuna opportunità
          </div>
        )}

        {extra > 0 && (
          <div className="rounded-lg bg-white/70 py-2 text-center text-xs font-medium text-slate-500 ring-1 ring-slate-200">
            +{extra} altri — affina con ricerca o filtri
          </div>
        )}
      </div>
    </div>
  );
}
