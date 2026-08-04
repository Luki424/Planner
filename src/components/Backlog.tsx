import { useMemo, useState } from 'react';
import { formatDateShort, formatDuration } from '../domain/dates';
import type { Context, ID, Task } from '../domain/types';
import { addTask, scheduleTask, toggleTask } from '../storage/store';

type Props = {
  tasks: Task[];
  contexts: Context[];
  activeContexts: Set<ID>;
  targetDate: string;
  today: string;
  onEditTask: (task: Task) => void;
  onNewTask: () => void;
};

export function Backlog({
  tasks,
  contexts,
  activeContexts,
  targetDate,
  today,
  onEditTask,
  onNewTask,
}: Props) {
  const [draft, setDraft] = useState('');
  const [draftContext, setDraftContext] = useState(contexts[0]?.id ?? '');
  const [draftDuration, setDraftDuration] = useState(30);

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
    addTask({ title: draft, contextId: draftContext, estimateMin: draftDuration });
    setDraft('');
  };

  const totalMin = visible.reduce((sum, t) => sum + t.estimateMin, 0);

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
        <select
          value={draftDuration}
          onChange={(e) => setDraftDuration(Number(e.target.value))}
          aria-label="Dauer"
        >
          {[15, 30, 45, 60, 90, 120, 180].map((d) => (
            <option key={d} value={d}>
              {d < 60 ? `${d}m` : `${d / 60}h`}
            </option>
          ))}
        </select>
        <button className="btn primary" type="submit" disabled={!draft.trim()}>
          +
        </button>
      </form>

      <ul className="task-list">
        {visible.map((task) => {
          const context = contexts.find((c) => c.id === task.contextId);
          const overdue = task.dueDate !== null && task.dueDate < today;
          return (
            <li
              key={task.id}
              className={`task-card${overdue ? ' overdue' : ''}`}
              style={{ '--accent': context?.color } as React.CSSProperties}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('planner/task', task.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <button
                className="check"
                aria-label="Als erledigt markieren"
                onClick={() => toggleTask(task.id)}
              />
              <button className="task-main" title={task.title} onClick={() => onEditTask(task)}>
                <span className="task-title">{task.title}</span>
                <span className="task-meta">
                  <span className="dot" />
                  {context?.name} · {formatDuration(task.estimateMin)}
                  {task.dueDate && <> · bis {formatDateShort(task.dueDate)}</>}
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
          Nichts im Pool. <button className="link" onClick={onNewTask}>Aufgabe anlegen</button>
        </p>
      )}
    </section>
  );
}
