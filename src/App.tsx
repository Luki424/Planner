import { useEffect, useMemo, useState } from 'react';
import { Backlog } from './components/Backlog';
import { BlockDialog } from './components/BlockDialog';
import { DayTimeline } from './components/DayTimeline';
import { Modal } from './components/Modal';
import { SeriesDialog } from './components/SeriesDialog';
import { SeriesView } from './components/SeriesView';
import { SettingsView } from './components/SettingsView';
import { TaskDialog } from './components/TaskDialog';
import { WeekView } from './components/WeekView';
import {
  addDays,
  formatDateLong,
  formatDuration,
  isoWeekNumber,
  today as todayISO,
  weekDates,
} from './domain/dates';
import { plannedMinutes } from './domain/scheduling';
import type { AppState, Block, ID, Series, Task } from './domain/types';
import { loadState, saveState } from './storage/db';
import {
  backlogTasks,
  configurePersistence,
  hydrate,
  materializeSeries,
  rolloverOpenTasks,
  useAppState,
} from './storage/store';

type View = 'day' | 'week' | 'series' | 'settings';

type Dialog =
  | { kind: 'task'; task: Task | null }
  | { kind: 'block'; block: Block | null; startMin: number }
  | { kind: 'series'; series: Series | null }
  | { kind: 'help' }
  | null;

export default function App() {
  const state = useAppState();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(todayISO);
  const [today, setToday] = useState(todayISO);
  const [hiddenContexts, setHiddenContexts] = useState<Set<ID>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    configurePersistence((next) => void saveState(next));
    void loadState<AppState>()
      .then((loaded) => hydrate(loaded))
      .catch(() => hydrate(null))
      .finally(() => setReady(true));
  }, []);

  // Ein über Mitternacht offener Tab soll trotzdem den richtigen Tag als "heute" führen.
  useEffect(() => {
    const timer = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const visibleDates = useMemo(
    () => (view === 'week' ? weekDates(date) : [date, today]),
    [view, date, today],
  );

  useEffect(() => {
    if (!ready) return;
    materializeSeries(visibleDates);
  }, [ready, visibleDates, state.series]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') setDate((d) => addDays(d, view === 'week' ? -7 : -1));
      else if (e.key === 'ArrowRight') setDate((d) => addDays(d, view === 'week' ? 7 : 1));
      else if (e.key === 't') setDate(todayISO());
      else if (e.key === 'd') setView('day');
      else if (e.key === 'w') setView('week');
      else if (e.key === 'n') {
        e.preventDefault();
        setDialog({ kind: 'task', task: null });
      } else if (e.key === '?') setDialog({ kind: 'help' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [view]);

  const activeContexts = useMemo(
    () => new Set(state.contexts.filter((c) => !hiddenContexts.has(c.id)).map((c) => c.id)),
    [state.contexts, hiddenContexts],
  );

  const dayBlocks = useMemo(
    () => state.blocks.filter((b) => b.date === date && activeContexts.has(b.contextId)),
    [state.blocks, date, activeContexts],
  );

  const planned = plannedMinutes(dayBlocks);
  const load = Math.round((planned / state.settings.capacityMin) * 100);
  const dayTasks = dayBlocks
    .map((b) => (b.taskId ? state.tasks.find((t) => t.id === b.taskId) : undefined))
    .filter((t): t is Task => Boolean(t));
  const doneCount = new Set(dayTasks.filter((t) => t.status === 'done').map((t) => t.id)).size;
  const openCount = new Set(dayTasks.filter((t) => t.status === 'open').map((t) => t.id)).size;

  const yesterday = addDays(date, -1);
  const rolloverCount = state.blocks.filter(
    (b) =>
      b.date === yesterday &&
      b.taskId &&
      state.tasks.find((t) => t.id === b.taskId)?.status === 'open',
  ).length;

  const pool = useMemo(() => backlogTasks(state), [state]);
  const defaultContextId = state.contexts[0]?.id ?? '';

  if (!ready) {
    return <div className="boot">Planer wird geladen …</div>;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden />
          <h1>Tagesplaner</h1>
        </div>

        <nav className="tabs" aria-label="Ansicht">
          {(
            [
              ['day', 'Tag'],
              ['week', 'Woche'],
              ['series', 'Serien'],
              ['settings', 'Einstellungen'],
            ] as Array<[View, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              className={`tab${view === key ? ' on' : ''}`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <button
            className="btn ghost"
            onClick={() => setDialog({ kind: 'help' })}
            title="Kurzhilfe"
          >
            ?
          </button>
        </div>
      </header>

      {(view === 'day' || view === 'week') && (
        <div className="subbar">
          <div className="date-nav">
            <button
              className="icon-btn"
              onClick={() => setDate(addDays(date, view === 'week' ? -7 : -1))}
              aria-label="Zurück"
            >
              ‹
            </button>
            <button className="btn ghost" onClick={() => setDate(today)}>
              Heute
            </button>
            <button
              className="icon-btn"
              onClick={() => setDate(addDays(date, view === 'week' ? 7 : 1))}
              aria-label="Weiter"
            >
              ›
            </button>
            <strong className="current-date">
              {view === 'week'
                ? `KW ${isoWeekNumber(date)} · ab ${formatDateLong(weekDates(date)[0])}`
                : formatDateLong(date)}
            </strong>
            {date === today && <span className="badge">heute</span>}
          </div>

          <div className="filters">
            {state.contexts.map((context) => {
              const on = !hiddenContexts.has(context.id);
              return (
                <button
                  key={context.id}
                  className={`chip${on ? ' on' : ''}`}
                  style={{ '--accent': context.color } as React.CSSProperties}
                  onClick={() =>
                    setHiddenContexts((current) => {
                      const next = new Set(current);
                      if (next.has(context.id)) next.delete(context.id);
                      else next.add(context.id);
                      return next;
                    })
                  }
                >
                  <span className="dot" />
                  {context.name}
                </button>
              );
            })}
          </div>

          {view === 'day' && (
            <div className="day-stats">
              <div className="load-bar wide" title={`${load}% der Tageskapazität verplant`}>
                <div
                  className={`load-fill${planned > state.settings.capacityMin ? ' over' : ''}`}
                  style={{ width: `${Math.min(100, load)}%` }}
                />
              </div>
              <span className="muted small">
                {formatDuration(planned)} von {formatDuration(state.settings.capacityMin)} verplant ·{' '}
                {doneCount} erledigt · {openCount} offen
              </span>
            </div>
          )}
        </div>
      )}

      <main className={`content view-${view}`}>
        {view === 'day' && (
          <>
            <Backlog
              tasks={pool}
              contexts={state.contexts}
              activeContexts={activeContexts}
              targetDate={date}
              today={today}
              onEditTask={(task) => setDialog({ kind: 'task', task })}
              onNewTask={() => setDialog({ kind: 'task', task: null })}
            />
            <div className="day-column">
              <div className="day-toolbar">
                <button
                  className="btn"
                  onClick={() =>
                    setDialog({
                      kind: 'block',
                      block: null,
                      startMin: state.settings.dayStartMin + 180,
                    })
                  }
                >
                  + Fester Termin
                </button>
                {rolloverCount > 0 && (
                  <button
                    className="btn ghost"
                    title="Nicht erledigte Aufgaben vom Vortag auf diesen Tag ziehen"
                    onClick={() => rolloverOpenTasks(yesterday, date)}
                  >
                    {rolloverCount} offene vom Vortag übernehmen
                  </button>
                )}
                <span className="spacer" />
                <span className="muted small hide-narrow">
                  Aufgaben aus dem Pool nach rechts ziehen · Doppelklick legt einen Termin an
                </span>
              </div>
              <DayTimeline
                date={date}
                today={today}
                blocks={state.blocks.filter((b) => b.date === date)}
                tasks={state.tasks}
                contexts={state.contexts}
                activeContexts={activeContexts}
                settings={state.settings}
                onEditBlock={(block) =>
                  setDialog({ kind: 'block', block, startMin: block.startMin })
                }
                onEditTask={(task) => setDialog({ kind: 'task', task })}
                onNewBlockAt={(startMin) => setDialog({ kind: 'block', block: null, startMin })}
              />
            </div>
          </>
        )}

        {view === 'week' && (
          <>
            <Backlog
              tasks={pool}
              contexts={state.contexts}
              activeContexts={activeContexts}
              targetDate={date}
              today={today}
              onEditTask={(task) => setDialog({ kind: 'task', task })}
              onNewTask={() => setDialog({ kind: 'task', task: null })}
            />
            <WeekView
              state={state}
              anchorDate={date}
              today={today}
              activeContexts={activeContexts}
              onOpenDay={(d) => {
                setDate(d);
                setView('day');
              }}
              onEditTask={(task) => setDialog({ kind: 'task', task })}
              onEditBlock={(block) => setDialog({ kind: 'block', block, startMin: block.startMin })}
            />
          </>
        )}

        {view === 'series' && (
          <SeriesView
            series={state.series}
            contexts={state.contexts}
            onEdit={(series) => setDialog({ kind: 'series', series })}
            onNew={() => setDialog({ kind: 'series', series: null })}
          />
        )}

        {view === 'settings' && <SettingsView state={state} />}
      </main>

      {dialog?.kind === 'task' && (
        <TaskDialog
          task={dialog.task}
          contexts={state.contexts}
          defaultContextId={defaultContextId}
          defaultDueDate={null}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'block' && (
        <BlockDialog
          block={dialog.block}
          date={date}
          startMin={dialog.startMin}
          contexts={state.contexts}
          defaultContextId={defaultContextId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'series' && (
        <SeriesDialog
          series={dialog.series}
          contexts={state.contexts}
          defaultContextId={defaultContextId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'help' && (
        <Modal title="Kurzhilfe" onClose={() => setDialog(null)}>
          <ul className="help-list">
            <li>
              <b>Pool → Plan:</b> Aufgabe aus dem Pool auf die Zeitachse ziehen, oder „Einplanen"
              klicken – dann sucht der Planer die nächste freie Lücke.
            </li>
            <li>
              <b>Verschieben:</b> Blöcke lassen sich ziehen; am unteren Rand ziehen ändert die Dauer.
            </li>
            <li>
              <b>Zurück in den Pool:</b> ↩ am Block. Die Aufgabe bleibt erhalten, nur der Zeitblock
              verschwindet.
            </li>
            <li>
              <b>Bereiche:</b> Über die Chips oben blendest du Beruflich/Privat einzeln aus.
            </li>
            <li>
              <b>Tastatur:</b> <kbd>←</kbd>/<kbd>→</kbd> Tag bzw. Woche wechseln, <kbd>t</kbd> heute,{' '}
              <kbd>d</kbd> Tagesansicht, <kbd>w</kbd> Wochenansicht, <kbd>n</kbd> neue Aufgabe.
            </li>
          </ul>
        </Modal>
      )}
    </div>
  );
}
