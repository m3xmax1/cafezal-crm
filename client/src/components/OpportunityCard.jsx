import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { SENS_BADGE } from '../lib/constants.js';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export default function OpportunityCard({ opp, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opp.id,
  });
  const downPos = useRef(null);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const d = daysUntil(opp.data_scadenza);
  const dueLabel =
    d === null
      ? null
      : d < 0
        ? `Scaduta da ${Math.abs(d)}g`
        : d === 0
          ? 'Scade oggi'
          : `Tra ${d}g`;
  const dueColor =
    d === null ? '' : d <= 0 ? 'text-red-600' : d <= 3 ? 'text-amber-600' : 'text-slate-400';

  // Distinguish a click (open editor) from a drag.
  function handlePointerDownCapture(e) {
    downPos.current = { x: e.clientX, y: e.clientY };
  }
  function handleClick(e) {
    // Threshold matches the PointerSensor activation distance (8px) so there is
    // no dead zone where a press neither drags nor opens the editor.
    const p = downPos.current;
    if (p && (Math.abs(e.clientX - p.x) > 8 || Math.abs(e.clientY - p.y) > 8)) return;
    onClick?.();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerDownCapture={handlePointerDownCapture}
      onClick={handleClick}
      className={`cursor-grab touch-none select-none rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-slate-800">{opp.azienda}</h4>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            SENS_BADGE[opp.sensibility] || 'bg-slate-100 text-slate-700'
          }`}
        >
          {opp.sensibility}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {opp.commerciale_assegnato ? (
          <span>👤 {opp.commerciale_assegnato}</span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            🆕 Pool
          </span>
        )}
        {opp.macchina && <span>⚙️ Macchina</span>}
        {opp.quantita_minima_kg != null && <span>📦 {opp.quantita_minima_kg} kg</span>}
      </div>

      {dueLabel && <div className={`mt-2 text-xs font-medium ${dueColor}`}>📅 {dueLabel}</div>}
    </div>
  );
}
