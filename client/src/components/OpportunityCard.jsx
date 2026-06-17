import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CATEGORIA_BADGE, SENS_DOT, CLOSED_FASI, followupStatus, fmtEuro } from '../lib/constants.js';

// Linear progression used by the "advance phase" quick action (K.O. is off-path).
const ADVANCE_ORDER = ['Lead', 'Contattato', 'In trattativa', 'Proposta', 'Chiuso'];
function nextFase(f) {
  const i = ADVANCE_ORDER.indexOf(f);
  return i >= 0 && i < ADVANCE_ORDER.length - 1 ? ADVANCE_ORDER[i + 1] : null;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

const IconUser = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
  </svg>
);
const IconCalendar = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
  </svg>
);
const IconBox = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8l-9-5-9 5m18 0l-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5" />
  </svg>
);

const BASE_CARD =
  'rounded-xl border border-slate-200 bg-white p-3 shadow-card transition-all duration-200 hover:border-slate-300 hover:shadow-card-hover';

// Inner content shared by the draggable (desktop) and static (mobile) cards.
function CardBody({ opp, onAdvance }) {
  const d = daysUntil(opp.data_scadenza);
  const dueLabel =
    d === null ? null : d < 0 ? `Scaduta da ${Math.abs(d)}g` : d === 0 ? 'Scade oggi' : `Tra ${d}g`;
  const dueColor =
    d === null ? '' : d <= 0 ? 'text-rose-600' : d <= 3 ? 'text-amber-600' : 'text-slate-400';

  const fu = followupStatus(opp.data_prossimo_followup);
  const needsPlan =
    !opp.data_prossimo_followup && opp.commerciale_assegnato && !CLOSED_FASI.includes(opp.fase_pipeline);

  return (
    <>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {opp.categoria ? (
          <span
            className={`max-w-[80%] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              CATEGORIA_BADGE[opp.categoria] || 'bg-slate-100 text-slate-700'
            }`}
          >
            {opp.categoria}
          </span>
        ) : (
          <span />
        )}
        <span
          title={`Sensibility: ${opp.sensibility}`}
          className={`h-2 w-2 shrink-0 rounded-full ${SENS_DOT[opp.sensibility] || 'bg-slate-300'}`}
        />
      </div>

      <h4 className="text-sm font-semibold leading-snug text-slate-800">{opp.azienda}</h4>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500">
        {opp.commerciale_assegnato ? (
          <span className="inline-flex items-center gap-1 font-medium text-slate-600">
            <IconUser className="h-3 w-3 text-slate-400" />
            {opp.commerciale_assegnato}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">
            Pool
          </span>
        )}
        {opp.macchina && (
          <span className="inline-flex items-center gap-1">
            <IconBox className="h-3 w-3 text-slate-400" />
            Macchina
          </span>
        )}
        {opp.quantita_minima_kg != null && <span>{opp.quantita_minima_kg} Kg/ev.</span>}
        {opp.valore_stimato != null && (
          <span className="font-semibold text-slate-700">{fmtEuro(opp.valore_stimato)}</span>
        )}
      </div>

      {fu && (
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium ${fu.text}`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${fu.dot}`} />
          <span className="shrink-0">Follow-up {fu.label}</span>
          {opp.prossima_azione && (
            <span className="truncate font-normal text-slate-400">· {opp.prossima_azione}</span>
          )}
        </div>
      )}
      {!fu && needsPlan && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          Da pianificare
        </div>
      )}

      {dueLabel && (
        <div className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium ${dueColor}`}>
          <IconCalendar className="h-3 w-3" />
          {dueLabel}
        </div>
      )}

      {onAdvance && nextFase(opp.fase_pipeline) && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAdvance(opp);
          }}
          title={`Avanza a ${nextFase(opp.fase_pipeline)}`}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {nextFase(opp.fase_pipeline)}
        </button>
      )}
    </>
  );
}

// Static, fully scrollable card for the mobile list (no drag → touch scrolls).
export function OpportunityCardStatic({ opp, onClick, onAdvance }) {
  return (
    <div
      onClick={onClick}
      className={`${BASE_CARD} cursor-pointer active:scale-[0.99]`}
    >
      <CardBody opp={opp} onAdvance={onAdvance} />
    </div>
  );
}

// Draggable card for the desktop kanban board.
export default function OpportunityCard({ opp, onClick, onAdvance }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id });
  const downPos = useRef(null);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  function handlePointerDownCapture(e) {
    downPos.current = { x: e.clientX, y: e.clientY };
  }
  function handleClick(e) {
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
      className={`${BASE_CARD} group cursor-grab touch-none select-none hover:-translate-y-0.5 active:cursor-grabbing ${
        isDragging ? 'opacity-60 shadow-card-hover' : ''
      }`}
    >
      <CardBody opp={opp} onAdvance={onAdvance} />
    </div>
  );
}
