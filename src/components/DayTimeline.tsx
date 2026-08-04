import { useEffect, useRef, useState } from 'react';
import { formatDuration, formatTime } from '../domain/dates';
import { blockEnd, clamp, layoutBlocks, snap } from '../domain/scheduling';
import type { Block, Context, ID, Settings, Task } from '../domain/types';
import { deleteBlock, scheduleTask, toggleTask, unscheduleTask, updateBlock } from '../storage/store';

export const PX_PER_MIN = 1;

type Props = {
  date: string;
  today: string;
  blocks: Block[];
  tasks: Task[];
  contexts: Context[];
  activeContexts: Set<ID>;
  settings: Settings;
  onEditBlock: (block: Block) => void;
  onEditTask: (task: Task) => void;
  onNewBlockAt: (startMin: number) => void;
};

export function DayTimeline({
  date,
  today,
  blocks,
  tasks,
  contexts,
  activeContexts,
  settings,
  onEditBlock,
  onEditTask,
  onNewBlockAt,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ id: ID; startY: number; startDuration: number } | null>(null);
  const [dropMin, setDropMin] = useState<number | null>(null);
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setNowMin(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Beim Tageswechsel dorthin scrollen, wo der Tag tatsächlich beginnt –
  // sonst blickt man morgens auf leere Stunden.
  const firstBlockStart = blocks.length ? Math.min(...blocks.map((b) => b.startMin)) : null;
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const anchor =
      firstBlockStart ?? (date === today ? nowMin : Math.max(settings.dayStartMin, 8 * 60));
    const offset = (anchor - settings.dayStartMin - 30) * PX_PER_MIN;
    container.scrollTop = Math.max(0, offset);
    // Nur beim Tageswechsel neu ausrichten, nicht bei jeder Planänderung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const totalMin = settings.dayEndMin - settings.dayStartMin;
  const hours: number[] = [];
  for (let m = Math.ceil(settings.dayStartMin / 60) * 60; m <= settings.dayEndMin; m += 60) hours.push(m);

  const visibleBlocks = blocks.filter((b) => activeContexts.has(b.contextId));
  const layout = layoutBlocks(visibleBlocks);

  const minutesFromClientY = (clientY: number): number => {
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return settings.dayStartMin;
    const raw = settings.dayStartMin + (clientY - rect.top) / PX_PER_MIN;
    return clamp(snap(raw, settings.slotMin), settings.dayStartMin, settings.dayEndMin - settings.slotMin);
  };

  const onDragOver = (e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (!types.includes('planner/task') && !types.includes('planner/block')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropMin(minutesFromClientY(e.clientY));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropMin(null);
    const start = minutesFromClientY(e.clientY);

    const taskId = e.dataTransfer.getData('planner/task');
    if (taskId) {
      scheduleTask(taskId, date, start);
      return;
    }
    const raw = e.dataTransfer.getData('planner/block');
    if (!raw) return;
    const payload = JSON.parse(raw) as { id: ID; grabOffsetMin: number };
    const moved = snap(start - payload.grabOffsetMin, settings.slotMin);
    updateBlock(payload.id, {
      date,
      startMin: clamp(moved, settings.dayStartMin, settings.dayEndMin - settings.slotMin),
    });
  };

  return (
    <div className="timeline panel">
      <div className="timeline-scroll" ref={scrollRef}>
        <div
          className="timeline-content"
          ref={contentRef}
          style={{ height: totalMin * PX_PER_MIN }}
          onDragOver={onDragOver}
          onDragLeave={() => setDropMin(null)}
          onDrop={onDrop}
          onDoubleClick={(e) => {
            if (e.target !== e.currentTarget) return;
            onNewBlockAt(minutesFromClientY(e.clientY));
          }}
        >
          {hours.map((m) => (
            <div
              key={m}
              className="hour-line"
              style={{ top: (m - settings.dayStartMin) * PX_PER_MIN }}
            >
              <span className="hour-label">{formatTime(m)}</span>
            </div>
          ))}

          {dropMin !== null && (
            <div
              className="drop-indicator"
              style={{ top: (dropMin - settings.dayStartMin) * PX_PER_MIN }}
            >
              <span>{formatTime(dropMin)}</span>
            </div>
          )}

          {date === today && nowMin >= settings.dayStartMin && nowMin <= settings.dayEndMin && (
            <div className="now-line" style={{ top: (nowMin - settings.dayStartMin) * PX_PER_MIN }}>
              <span>{formatTime(nowMin)}</span>
            </div>
          )}

          {visibleBlocks.map((block) => {
            const task = block.taskId ? tasks.find((t) => t.id === block.taskId) : undefined;
            const context = contexts.find((c) => c.id === block.contextId);
            const place = layout.get(block.id) ?? { column: 0, columns: 1 };
            const done = task?.status === 'done';
            const width = 100 / place.columns;
            return (
              <article
                key={block.id}
                className={`block${done ? ' done' : ''}${task ? '' : ' fixed'}`}
                style={
                  {
                    top: (block.startMin - settings.dayStartMin) * PX_PER_MIN,
                    height: Math.max(block.durationMin * PX_PER_MIN, 20),
                    left: `calc(${place.column * width}% + 3px)`,
                    width: `calc(${width}% - 6px)`,
                    '--accent': context?.color,
                  } as React.CSSProperties
                }
                draggable
                onDragStart={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const grabOffsetMin = (e.clientY - rect.top) / PX_PER_MIN;
                  e.dataTransfer.setData(
                    'planner/block',
                    JSON.stringify({ id: block.id, grabOffsetMin }),
                  );
                  e.dataTransfer.effectAllowed = 'move';
                }}
              >
                <div className="block-head">
                  {task && (
                    <button
                      className="check"
                      aria-label="Erledigt"
                      onClick={() => toggleTask(task.id)}
                    />
                  )}
                  <button
                    className="block-title"
                    onClick={() => (task ? onEditTask(task) : onEditBlock(block))}
                  >
                    {task ? task.title : block.title}
                  </button>
                </div>
                <div className="block-meta">
                  {formatTime(block.startMin)}–{formatTime(blockEnd(block))} ·{' '}
                  {formatDuration(block.durationMin)}
                </div>
                <div className="block-actions">
                  {task ? (
                    <button title="Zurück in den Pool" onClick={() => unscheduleTask(task.id)}>
                      ↩
                    </button>
                  ) : (
                    <button title="Termin löschen" onClick={() => deleteBlock(block.id)}>
                      ×
                    </button>
                  )}
                </div>
                <div
                  className="resize-handle"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    resizeRef.current = {
                      id: block.id,
                      startY: e.clientY,
                      startDuration: block.durationMin,
                    };
                  }}
                  onPointerMove={(e) => {
                    const active = resizeRef.current;
                    if (!active) return;
                    const delta = (e.clientY - active.startY) / PX_PER_MIN;
                    const next = Math.max(
                      settings.slotMin,
                      snap(active.startDuration + delta, settings.slotMin),
                    );
                    updateBlock(active.id, { durationMin: next });
                  }}
                  onPointerUp={(e) => {
                    resizeRef.current = null;
                    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                  }}
                />
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
