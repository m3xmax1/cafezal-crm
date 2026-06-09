import { DndContext, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { FASI } from '../lib/constants.js';
import KanbanColumn from './KanbanColumn.jsx';

export default function KanbanBoard({ items, onCardClick, onMove }) {
  // distance constraint → small movements count as clicks, larger as drags
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {FASI.map((f) => (
          <KanbanColumn key={f} fase={f} items={byFase[f] || []} onCardClick={onCardClick} />
        ))}
      </div>
    </DndContext>
  );
}
