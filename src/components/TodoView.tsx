import { useMemo, useState } from 'react';
import { formatDueDate, formatDuration } from '../domain/dates';
import { memberIdsOf } from '../domain/people';
import { NO_LIST, dueToday, groupByList, isOverdue, openCountByList } from '../domain/todo';
import type { AppState, ID, Task } from '../domain/types';
import { dragHandleProps, useDrag } from '../hooks/dragContext';
import {
  addTask,
  addTaskList,
  deleteTaskList,
  moveTaskList,
  scheduleTask,
  toggleTask,
  updateTask,
  updateTaskList,
} from '../storage/store';
import { MemberDots } from './MemberPicker';

type Props = {
  state: AppState;
  today: string;
  activeContexts: Set<ID>;
  onEditTask: (task: Task) => void;
  /** Für „Einplanen": auf welchen Tag. */
  targetDate: string;
};

/**
 * Die Aufgabenliste.
 *
 * Dieselben Aufgaben wie im Pool, aber in voller Breite und ohne Zeitachse
 * daneben: eintippen, abhaken, in Listen sortieren. Wer eine Erledigung doch
 * einplanen will, tippt „Einplanen" oder zieht sie am Griff in den Tag – sie
 * muss nirgends neu eingetippt werden.
 */
export function TodoView({ state, today, activeContexts, onEditTask, targetDate }: Props) {
  const [entwurf, setEntwurf] = useState('');
  const [zielListe, setZielListe] = useState<string>(NO_LIST);
  const [aktiveListen, setAktiveListen] = useState<Set<string>>(new Set());
  const [zeigeErledigte, setZeigeErledigte] = useState(false);
  const [neueListe, setNeueListe] = useState('');
  const [listenVerwalten, setListenVerwalten] = useState(false);

  const { startDrag, state: dragState } = useDrag();

  /*
   * Eingeplante Aufgaben stehen im Tagesplan und gehören nicht noch einmal
   * auf die Liste – sonst hakte man sie an zwei Stellen ab.
   */
  const offeneAufgaben = useMemo(() => {
    const eingeplant = new Set(state.blocks.filter((b) => b.taskId).map((b) => b.taskId!));
    return state.tasks.filter((t) => !eingeplant.has(t.id));
  }, [state.tasks, state.blocks]);

  const faellig = useMemo(
    () =>
      dueToday(
        offeneAufgaben.filter((t) => activeContexts.has(t.contextId)),
        today,
      ),
    [offeneAufgaben, activeContexts, today],
  );

  /*
   * Was oben unter "Heute fällig" steht, erscheint unten nicht noch einmal.
   * Jede Aufgabe soll genau eine Zeile haben – sonst hakt man sie einmal ab
   * und sucht, warum sie noch dasteht.
   */
  const gruppen = useMemo(() => {
    const obenGezeigt = new Set(faellig.map((t) => t.id));
    return groupByList({
      tasks: offeneAufgaben.filter((t) => !obenGezeigt.has(t.id)),
      lists: state.taskLists,
      activeContexts,
      activeLists: aktiveListen,
      showDone: zeigeErledigte,
    });
  }, [offeneAufgaben, faellig, state.taskLists, activeContexts, aktiveListen, zeigeErledigte]);

  const zaehler = useMemo(() => openCountByList(offeneAufgaben), [offeneAufgaben]);
  const offenGesamt = faellig.length + gruppen.reduce((n, g) => n + g.open.length, 0);

  const listenUmschalten = (key: string) =>
    setAktiveListen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const eintragen = () => {
    if (!entwurf.trim()) return;
    addTask({
      title: entwurf,
      contextId: state.contexts[0]?.id ?? '',
      listId: zielListe === NO_LIST ? null : zielListe,
      // Ohne Dauerangabe: eine Erledigung braucht keine Schätzung. Beim
      // Einplanen wird daraus eine halbe Stunde.
      estimateMin: 0,
    });
    setEntwurf('');
  };

  return (
    <section className="panel wide todo">
      <header className="panel-head">
        <h2>Zu erledigen</h2>
        <span className="muted small">
          {offenGesamt} offen
          {faellig.length > 0 && ` · ${faellig.length} fällig`}
        </span>
      </header>

      <form
        className="todo-add"
        onSubmit={(e) => {
          e.preventDefault();
          eintragen();
        }}
      >
        <input
          value={entwurf}
          onChange={(e) => setEntwurf(e.target.value)}
          placeholder="Was ist zu tun?"
          aria-label="Neue Erledigung"
        />
        {state.taskLists.length > 0 && (
          <select
            value={zielListe}
            onChange={(e) => setZielListe(e.target.value)}
            aria-label="In welche Liste"
          >
            <option value={NO_LIST}>Ohne Liste</option>
            {[...state.taskLists]
              .sort((a, b) => a.order - b.order)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        )}
        <button className="btn primary" type="submit" disabled={!entwurf.trim()}>
          +
        </button>
      </form>

      {faellig.length > 0 && (
        <div className="todo-due">
          <h3>Heute fällig</h3>
          <ul className="todo-list">
            {faellig.map((task) => (
              <TodoRow
                key={task.id}
                task={task}
                state={state}
                today={today}
                targetDate={targetDate}
                onEdit={() => onEditTask(task)}
                startDrag={startDrag}
                dragging={
                  dragState?.payload.kind === 'task' && dragState.payload.taskId === task.id
                }
              />
            ))}
          </ul>
        </div>
      )}

      {/*
        Die Zeile steht immer – auch ohne Listen, denn „Erledigtes zeigen"
        gehört unabhängig davon dazu.
      */}
      <div className="filters todo-filters">
        {state.taskLists.length > 0 && (
          <>
            <button
              className={`chip${aktiveListen.has(NO_LIST) ? ' on' : ''}`}
              onClick={() => listenUmschalten(NO_LIST)}
            >
              Ohne Liste
              {zaehler.get(NO_LIST) ? (
                <span className="chip-count">{zaehler.get(NO_LIST)}</span>
              ) : null}
            </button>
            {[...state.taskLists]
              .sort((a, b) => a.order - b.order)
              .map((l) => (
                <button
                  key={l.id}
                  className={`chip${aktiveListen.has(l.id) ? ' on' : ''}`}
                  onClick={() => listenUmschalten(l.id)}
                >
                  {l.name}
                  {zaehler.get(l.id) ? (
                    <span className="chip-count">{zaehler.get(l.id)}</span>
                  ) : null}
                </button>
              ))}
            {aktiveListen.size > 0 && (
              <button className="btn tiny ghost" onClick={() => setAktiveListen(new Set())}>
                Filter zurücksetzen
              </button>
            )}
          </>
        )}
        <span className="spacer" />
        <label className="check-field small">
          <input
            type="checkbox"
            checked={zeigeErledigte}
            onChange={(e) => setZeigeErledigte(e.target.checked)}
          />
          Erledigtes zeigen
        </label>
      </div>

      {gruppen.length === 0 && (
        <p className="empty">
          Nichts zu tun. Tipp oben ein, was ansteht – ein Datum braucht es nicht, und einplanen
          kannst du es später immer noch.
        </p>
      )}

      {gruppen.map((gruppe) => (
        <div className="todo-group" key={gruppe.list?.id ?? NO_LIST}>
          <header className="panel-head slim">
            <h3>{gruppe.list ? gruppe.list.name : 'Ohne Liste'}</h3>
            <span className="muted small">
              {gruppe.open.length} offen
              {zeigeErledigte && gruppe.done.length > 0 && ` · ${gruppe.done.length} erledigt`}
            </span>
          </header>

          {gruppe.open.length === 0 && gruppe.done.length === 0 ? (
            <p className="hint">Nichts drin.</p>
          ) : (
            <ul className="todo-list">
              {gruppe.open.map((task) => (
                <TodoRow
                  key={task.id}
                  task={task}
                  state={state}
                  today={today}
                  targetDate={targetDate}
                  onEdit={() => onEditTask(task)}
                  startDrag={startDrag}
                  dragging={
                    dragState?.payload.kind === 'task' && dragState.payload.taskId === task.id
                  }
                />
              ))}
              {zeigeErledigte &&
                gruppe.done.map((task) => (
                  <TodoRow
                    key={task.id}
                    task={task}
                    state={state}
                    today={today}
                    targetDate={targetDate}
                    onEdit={() => onEditTask(task)}
                    startDrag={startDrag}
                    dragging={false}
                  />
                ))}
            </ul>
          )}
        </div>
      ))}

      <div className="settings-group">
        <div className="button-row">
          <button className="btn tiny ghost" onClick={() => setListenVerwalten(!listenVerwalten)}>
            {listenVerwalten ? 'Listen schließen' : 'Listen verwalten'}
          </button>
        </div>

        {listenVerwalten && (
          <>
            <p className="hint">
              Listen ordnen, worum es geht – „Haus", „Garten", „Umzug". Die Bereiche daneben sagen,
              ob etwas beruflich oder privat ist; beides zugleich zu verlangen wäre lästig, deshalb
              ist die Liste freiwillig.
            </p>
            <ul className="context-list">
              {[...state.taskLists]
                .sort((a, b) => a.order - b.order)
                .map((l, i, alle) => (
                  <li key={l.id} className="context-row">
                    <input
                      value={l.name}
                      onChange={(e) => updateTaskList(l.id, { name: e.target.value })}
                      aria-label={`Name der Liste ${l.name}`}
                    />
                    <button
                      className="icon-btn"
                      onClick={() => moveTaskList(l.id, -1)}
                      disabled={i === 0}
                      aria-label="Nach oben"
                    >
                      ↑
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => moveTaskList(l.id, 1)}
                      disabled={i === alle.length - 1}
                      aria-label="Nach unten"
                    >
                      ↓
                    </button>
                    <button
                      className="btn tiny danger ghost"
                      onClick={() => deleteTaskList(l.id)}
                      title="Liste entfernen. Ihre Aufgaben bleiben und stehen dann ohne Liste."
                    >
                      Löschen
                    </button>
                  </li>
                ))}
            </ul>
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!neueListe.trim()) return;
                addTaskList(neueListe);
                setNeueListe('');
              }}
            >
              <input
                value={neueListe}
                onChange={(e) => setNeueListe(e.target.value)}
                placeholder="Liste hinzufügen"
                aria-label="Neue Liste"
              />
              <button className="btn" type="submit" disabled={!neueListe.trim()}>
                Anlegen
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Eine Zeile */

function TodoRow({
  task,
  state,
  today,
  targetDate,
  onEdit,
  startDrag,
  dragging,
}: {
  task: Task;
  state: AppState;
  today: string;
  targetDate: string;
  onEdit: () => void;
  startDrag: ReturnType<typeof useDrag>['startDrag'];
  dragging: boolean;
}) {
  const context = state.contexts.find((c) => c.id === task.contextId);
  const erledigt = task.status === 'done';
  const ueberfaellig = isOverdue(task, today);

  return (
    <li
      className={`todo-row${erledigt ? ' done' : ''}${ueberfaellig ? ' overdue' : ''}${
        dragging ? ' dragging' : ''
      }`}
      style={{ '--accent': context?.color } as React.CSSProperties}
    >
      <span
        {...dragHandleProps(startDrag, {
          kind: 'task',
          taskId: task.id,
          label: task.title,
          durationMin: task.estimateMin || 30,
        })}
        title="Ziehen, um einzuplanen"
      />
      <button
        className="check"
        aria-label={erledigt ? 'Wieder öffnen' : 'Erledigt'}
        onClick={() => toggleTask(task.id)}
      />
      <button className="todo-main" onClick={onEdit} title={task.title}>
        <span className="todo-title">{task.title}</span>
        <span className="task-meta">
          <span className="dot" />
          {context?.name}
          {task.estimateMin > 0 && ` · ${formatDuration(task.estimateMin)}`}
          {task.dueDate && ` · bis ${formatDueDate(task.dueDate, today)}`}
          {task.seriesId && ' · wiederkehrend'}
        </span>
      </button>
      <MemberDots memberIds={memberIdsOf(task)} members={state.members} withInitials />
      {!erledigt && (
        <>
          {state.taskLists.length > 0 && (
            <select
              className="todo-list-picker"
              value={task.listId ?? NO_LIST}
              onChange={(e) =>
                updateTask(task.id, {
                  listId: e.target.value === NO_LIST ? null : e.target.value,
                })
              }
              aria-label={`Liste für ${task.title}`}
            >
              <option value={NO_LIST}>Ohne Liste</option>
              {[...state.taskLists]
                .sort((a, b) => a.order - b.order)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          )}
          <button
            className="btn tiny"
            title="In den Tagesplan legen"
            onClick={() => scheduleTask(task.id, targetDate)}
          >
            Einplanen
          </button>
        </>
      )}
    </li>
  );
}
