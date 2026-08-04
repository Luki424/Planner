import { useState } from 'react';
import {
  WEEKDAY_SHORT,
  formatDateShort,
  formatDuration,
  formatTime,
  weekDates,
  weekdayIndex,
} from '../domain/dates';
import { blockEnd, plannedMinutes } from '../domain/scheduling';
import type { AppState, Block, ID, Task } from '../domain/types';
import { scheduleTask, toggleTask, updateBlock } from '../storage/store';

type Props = {
  state: AppState;
  anchorDate: string;
  today: string;
  activeContexts: Set<ID>;
  onOpenDay: (date: string) => void;
  onEditTask: (task: Task) => void;
  onEditBlock: (block: Block) => void;
};

export function WeekView({
  state,
  anchorDate,
  today,
  activeContexts,
  onOpenDay,
  onEditTask,
  onEditBlock,
}: Props) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const days = weekDates(anchorDate);

  const handleDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const taskId = e.dataTransfer.getData('planner/task');
    if (taskId) {
      scheduleTask(taskId, date);
      return;
    }
    const raw = e.dataTransfer.getData('planner/block');
    if (!raw) return;
    const payload = JSON.parse(raw) as { id: ID };
    updateBlock(payload.id, { date });
  };

  return (
    <div className="week">
      {days.map((date) => {
        const dayBlocks = state.blocks
          .filter((b) => b.date === date && activeContexts.has(b.contextId))
          .sort((a, b) => a.startMin - b.startMin);
        const planned = plannedMinutes(dayBlocks);
        const load = Math.min(100, Math.round((planned / state.settings.capacityMin) * 100));
        const isToday = date === today;
        const isWeekend = weekdayIndex(date) >= 5;

        return (
          <section
            key={date}
            className={[
              'week-day panel',
              isToday ? 'is-today' : '',
              isWeekend ? 'is-weekend' : '',
              dragOverDate === date ? 'drag-over' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={(e) => {
              const types = e.dataTransfer.types;
              if (!types.includes('planner/task') && !types.includes('planner/block')) return;
              e.preventDefault();
              setDragOverDate(date);
            }}
            onDragLeave={() => setDragOverDate((d) => (d === date ? null : d))}
            onDrop={(e) => handleDrop(e, date)}
          >
            <header className="week-day-head">
              <button className="link strong" onClick={() => onOpenDay(date)}>
                {WEEKDAY_SHORT[weekdayIndex(date)]} {formatDateShort(date)}
              </button>
              <span className="muted small">{planned > 0 ? formatDuration(planned) : '–'}</span>
            </header>

            <div className="load-bar" title={`${load}% der Tageskapazität verplant`}>
              <div
                className={`load-fill${planned > state.settings.capacityMin ? ' over' : ''}`}
                style={{ width: `${load}%` }}
              />
            </div>

            <ul className="week-blocks">
              {dayBlocks.map((block) => {
                const task = block.taskId
                  ? state.tasks.find((t) => t.id === block.taskId)
                  : undefined;
                const context = state.contexts.find((c) => c.id === block.contextId);
                return (
                  <li
                    key={block.id}
                    className={`week-block${task?.status === 'done' ? ' done' : ''}`}
                    style={{ '--accent': context?.color } as React.CSSProperties}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'planner/block',
                        JSON.stringify({ id: block.id, grabOffsetMin: 0 }),
                      );
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                  >
                    {task && (
                      <button
                        className="check"
                        aria-label="Erledigt"
                        onClick={() => toggleTask(task.id)}
                      />
                    )}
                    <button
                      className="week-block-main"
                      title={task ? task.title : block.title}
                      onClick={() => (task ? onEditTask(task) : onEditBlock(block))}
                    >
                      <span className="week-block-time">
                        {formatTime(block.startMin)}–{formatTime(blockEnd(block))}
                      </span>
                      <span className="week-block-title">{task ? task.title : block.title}</span>
                    </button>
                  </li>
                );
              })}
              {dayBlocks.length === 0 && <li className="week-empty">frei</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
