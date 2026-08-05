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
import { dragHandleProps, useDrag } from '../hooks/dragContext';
import { toggleTask } from '../storage/store';

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
  const { startDrag, state: dragState } = useDrag();
  const days = weekDates(anchorDate);
  const dragOverDate =
    dragState?.target?.kind === 'day' ? dragState.target.date : null;

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
            data-drop="day"
            data-date={date}
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
                    className={`week-block${task?.status === 'done' ? ' done' : ''}${
                      dragState?.payload.kind === 'block' && dragState.payload.blockId === block.id
                        ? ' dragging'
                        : ''
                    }`}
                    style={{ '--accent': context?.color } as React.CSSProperties}
                  >
                    <span
                      {...dragHandleProps(startDrag, {
                        kind: 'block',
                        blockId: block.id,
                        label: task ? task.title : block.title,
                        durationMin: block.durationMin,
                        grabOffsetMin: 0,
                      })}
                      title="Ziehen, um den Tag zu wechseln"
                    />
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
