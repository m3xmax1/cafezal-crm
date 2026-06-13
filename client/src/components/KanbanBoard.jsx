import { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { FASI, FASE_ACCENT } from '../lib/constants.js';
import KanbanColumn from './KanbanColumn.jsx';
import { OpportunityCardStatic } from './OpportunityCard.jsx';

const CAP = 60;

export default function KanbanBoard({ items, onCardClick, onMove }) {
  // distance constraint → small movements count as clicks, larger as drags
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [mobileFase, setMobileFase] = useState(FASI[0]);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const opp = items.find((o) => o.id === active.id);
    const newFase = over.id;
    if (opp && FASI.includes(newFase) && opp.fase_pipeline !== newFase) {
      onMove(opp, newFase);
    }
  }

  const byFase = Object.fromEntries(FASI.map((f) => [f, []]));
  for (const o of items) {
    if (!byFase[o.fase_pipeline]) byFase[o.fase_pipeline] = [];
    byFase[o.fase_pipeline].push(o);
  }

  const mobileItems = byFase[mobileFase] || [];
  const mShown = mobileItems.slice(0, CAP);
  const mExtra = mobileItems.length - mShown.length;

  return (
    <>
      {/* Desktop / tablet: multi-column board with drag & drop */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="hidden gap-4 overflow-x-auto pb-4 lg:flex">
          {FASI.map((f) => (
            <KanbanColumn key={f} fase={f} items={byFase[f] || []} onCardClick={onCardClick} />
          ))}
        </div>
      </DndContext>

      {/* Mobile: phase selector + single, fully scrollable column */}
      <div className="lg:hidden">
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {FASI.map((f) => {
            const n = (byFase[f] || []).length;
            const active = f === mobileFase;
            return (
              <button
                key={f}
                onClick={() => setMobileFase(f)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${active ? 'bg-white/80' : FASE_ACCENT[f] || 'bg-slate-400'}`} />
                {f}
                <span
                  className={`rounded-full px-1.5 text-xs font-semibold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5">
          {mShown.map((o) => (
            <OpportunityCardStatic key={o.id} opp={o} onClick={() => onCardClick(o)} />
          ))}
          {mobileItems.length === 0 && (
            <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 py-12 text-sm text-slate-400">
              Nessuna opportunità in “{mobileFase}”.
            </div>
          )}
          {mExtra > 0 && (
            <div className="rounded-lg bg-white py-2 text-center text-xs font-medium text-slate-500 ring-1 ring-slate-200">
              +{mExtra} altri — affina con ricerca o filtri
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-slate-400">
          Tocca un lead per aprirlo. Per spostarlo di fase usa il menu “Fase pipeline” nella scheda.
        </p>
      </div>
    </>
  );
}
