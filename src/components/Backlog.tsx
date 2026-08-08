import { useMemo, useState } from 'react';
import { formatDueDate, formatDuration } from '../domain/dates';
import { memberIdsOf } from '../domain/people';
import type { Context, ID, Member, Task } from '../domain/types';
import { dragHandleProps, useDrag } from '../hooks/dragContext';
import { addTask, scheduleTask, toggleTask } from '../storage/store';
import { DurationSelect } from './DurationSelect';
import { MemberDots } from './MemberPicker';

type Props = {
  tasks: Task[];
  contexts: Context[];
  members: Member[];
  activeContexts: Set<ID>;
  targetDate: string;
  today: string;
  /** Tageskapazität – ganztägige Aufgaben zählen damit. */
  capacityMin: number;
  onEditTask: (task: Task) => void;
  onNewTask: () => void;
};

export function Backlog({
  tasks,
  contexts,
  members,
  activeContexts,
  targetDate,
  today,
  capacityMin,
  onEditTask,
  onNewTask,
}: Props) {
  const [draft, setDraft] = useState('');
  const [draftContext, setDraftContext] = useState(contexts[0]?.id ?? '');
  const [draftDuration, setDraftDuration] = useState(30);
  const [draftAllDay, setDraftAllDay] = useState(false);
  const { startDrag, state: dragState } = useDrag();

  const visible = useMemo(() => {
    const filtered = tasks.filter((t) => activeContexts.has(t.contextId));
    return filtered.sort((a, b) => {
      // Fälliges zuerst, Undatiertes ans Ende.
      const da = a.dueDate ?? '9999-12-31';
      const db = b.dueDate ?? '9999-12-31';
      if (da !== db) return da < db ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
  }, [tasks, activeContexts]);

  const submitDraft = () => {
    if (!draft.trim()) return;
    addTask({
      title: draft,
      contextId: draftContext,
      estimateMin: draftAllDay ? 0 : draftDuration,
      allDay: draftAllDay,
    });
    setDraft('');
  };

  // Ganztägiges nimmt den ganzen Tag – sonst sähe der Pool harmloser aus,
  // als er ist.
  const totalMin = visible.reduce((sum, t) => sum + (t.allDay ? capacityMin : t.estimateMin), 0);

  return (
    <section className="backlog panel">
      <header className="panel-head">
        <h2>Aufgabenpool</h2>
        <span className="muted">
          {visible.length} offen · {formatDuration(totalMin)}
        </span>
      </header>

      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault();
          submitDraft();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Aufgabe erfassen …"
          aria-label="Neue Aufgabe"
        />
        <select
          value={draftContext}
          onChange={(e) => setDraftContext(e.target.value)}
          aria-label="Bereich"
        >
          {contexts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <DurationSelect
          estimateMin={draftDuration}
          allDay={draftAllDay}
          onChange={({ estimateMin, allDay }) => {
            setDraftDuration(estimateMin);
            setDraftAllDay(allDay);
          }}
          options={[15, 30, 45, 60, 90, 120, 180]}
          compact
        />
        <button className="btn primary" type="submit" disabled={!draft.trim()}>
          +
        </button>
      </form>

      <ul
        className={`task-list${dragState?.target?.kind === 'pool' ? ' drop-active' : ''}`}
        data-drop="pool"
        data-autoscroll="true"
      >
        {visible.map((task) => {
          const context = contexts.find((c) => c.id === task.contextId);
          const overdue = task.dueDate !== null && task.dueDate < today;
          const dragging =
            dragState?.payload.kind === 'task' && dragState.payload.taskId === task.id;
          return (
            <li
              key={task.id}
              className={`task-card${overdue ? ' overdue' : ''}${dragging ? ' dragging' : ''}`}
              style={{ '--accent': context?.color } as React.CSSProperties}
            >
              <span
                {...dragHandleProps(startDrag, {
                  kind: 'task',
                  taskId: task.id,
                  label: task.title,
                  durationMin: task.estimateMin,
                })}
                title="Ziehen, um einzuplanen"
              />
              <button
                className="check"
                aria-label="Als erledigt markieren"
                onClick={() => toggleTask(task.id)}
              />
              <button className="task-main" title={task.title} onClick={() => onEditTask(task)}>
                <span className="task-title-row">
                  <span className="task-title">{task.title}</span>
                  <MemberDots memberIds={memberIdsOf(task)} members={members} withInitials />
                </span>
                <span className="task-meta">
                  <span className="dot" />
                  {context?.name}
                  {/* Erledigungen aus der Liste haben keine Dauer – dann steht dort auch keine. */}
                  {task.allDay ? (
                    <> · ganztägig</>
                  ) : (
                    task.estimateMin > 0 && <> · {formatDuration(task.estimateMin)}</>
                  )}
                  {task.dueDate && <> · bis {formatDueDate(task.dueDate, today)}</>}
                  {task.seriesId && <> · wiederkehrend</>}
                </span>
              </button>
              <button
                className="btn tiny"
                title="In den Tagesplan legen"
                onClick={() => scheduleTask(task.id, targetDate)}
              >
                Einplanen
              </button>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="empty">
          Nichts im Pool.{' '}
          <button className="link" onClick={onNewTask}>
            Aufgabe anlegen
          </button>
        </p>
      )}
    </section>
  );
}
