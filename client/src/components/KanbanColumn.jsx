import { useDroppable } from '@dnd-kit/core';
import { FASE_COLORS, FASE_HEADER } from '../lib/constants.js';
import OpportunityCard from './OpportunityCard.jsx';

export default function KanbanColumn({ fase, items, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: fase });

  return (
    <div className="flex w-72 shrink-0 flex-col sm:w-80">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className={`text-sm font-bold uppercase tracking-wide ${FASE_HEADER[fase] || 'text-slate-700'}`}>
          {fase}
        </h3>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-1 flex-col gap-2 rounded-2xl border-2 border-dashed p-2 transition ${
          FASE_COLORS[fase] || 'bg-slate-50 border-slate-200'
        } ${isOver ? 'ring-2 ring-slate-400' : ''}`}
      >
        {items.map((o) => (
          <OpportunityCard key={o.id} opp={o} onClick={() => onCardClick(o)} />
        ))}
        {items.length === 0 && (
          <div className="grid flex-1 place-items-center py-6 text-xs text-slate-400">
            Nessuna opportunità
          </div>
        )}
      </div>
    </div>
  );
}
