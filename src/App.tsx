import { useCallback, useEffect, useMemo, useState } from 'react';
import { Backlog } from './components/Backlog';
import { BlockDialog } from './components/BlockDialog';
import { DayTimeline } from './components/DayTimeline';
import { Modal } from './components/Modal';
import { SeriesDialog } from './components/SeriesDialog';
import { SeriesView } from './components/SeriesView';
import { SettingsView } from './components/SettingsView';
import { StartScreen } from './components/StartScreen';
import { ShoppingView } from './components/ShoppingView';
import { SyncBar } from './components/SyncBar';
import { TaskDialog } from './components/TaskDialog';
import { TripView } from './components/TripView';
import { UpdateBanner } from './components/UpdateBanner';
import { VacationView } from './components/VacationView';
import { VoiceCapture } from './components/VoiceCapture';
import { WeekView } from './components/WeekView';
import {
  addDays,
  formatDateLong,
  formatDateShort,
  formatDuration,
  isoWeekNumber,
  today as todayISO,
  weekDates,
} from './domain/dates';
import { holidayMap, type Bundesland } from './domain/holidays';
import { ABSENCE_LABELS, absencesOn } from './domain/leave';
import { blockMemberIds, matchesMembers, memberIdsOf } from './domain/people';
import { clamp, plannedMinutes, snap } from './domain/scheduling';
import type { AppState, Block, ID, Series, Task } from './domain/types';
import type { Parsed } from './domain/voice';
import { type DragPayload, type DropTarget } from './hooks/dragContext';
import { DragProvider } from './hooks/useDragDrop';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useSync } from './sync/useSync';
import { loadState, saveState, saveStateSync } from './storage/db';
import {
  addFixedBlock,
  addShoppingItems,
  addTask,
  addTrip,
  backlogTasks,
  configurePersistence,
  flushPersistence,
  hydrate,
  materializeSeries,
  rolloverOpenTasks,
  scheduleTask,
  unscheduleTask,
  updateAbsence,
  updateBlock,
  useAppState,
} from './storage/store';

type View = 'day' | 'week' | 'shopping' | 'vacation' | 'series' | 'settings';

/** Synchron lesbare Kopie für den Startbildschirm. */
const PHOTO_KEY = 'planner:photo';
const CAPTION_KEY = 'planner:caption';

type Dialog =
  | { kind: 'task'; task: Task | null }
  | { kind: 'block'; block: Block | null; startMin: number }
  | { kind: 'series'; series: Series | null }
  | { kind: 'help' }
  | null;

const TABS: Array<[View, string, string]> = [
  ['day', 'Tag', '📅'],
  ['week', 'Woche', '🗓️'],
  ['shopping', 'Einkauf', '🛒'],
  ['vacation', 'Urlaub', '🌴'],
  ['series', 'Serien', '🔁'],
  ['settings', 'Mehr', '⚙️'],
];

export default function App() {
  const state = useAppState();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(todayISO);
  const [today, setToday] = useState(todayISO);
  const [hiddenContexts, setHiddenContexts] = useState<Set<ID>>(new Set());
  const [hiddenMembers, setHiddenMembers] = useState<Set<ID>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dayPane, setDayPane] = useState<'plan' | 'pool'>('plan');
  /*
   * Der Startbildschirm erscheint, bevor der gespeicherte Stand gelesen ist –
   * das Foto muss also ohne ihn auskommen. Deshalb liegt eine Kopie synchron
   * lesbar in localStorage.
   */
  const [startPhoto] = useState(() => {
    try {
      return {
        photo: localStorage.getItem(PHOTO_KEY),
        caption: localStorage.getItem(CAPTION_KEY) ?? '',
      };
    } catch {
      return { photo: null, caption: '' };
    }
  });
  const [startVisible, setStartVisible] = useState(true);
  /** Geöffnete Reise; null zeigt die Jahresübersicht. */
  const [openTripId, setOpenTripId] = useState<string | null>(null);

  const compact = useMediaQuery('(max-width: 860px)');
  const sync = useSync(ready);
  const update = useAppUpdate();

  useEffect(() => {
    configurePersistence(
      (next) => void saveState(next),
      (next) => saveStateSync(next),
    );
    void loadState<AppState>()
      .then((loaded) => hydrate(loaded))
      .catch(() => hydrate(null))
      .finally(() => setReady(true));
  }, []);

  // Kopie für den nächsten Start bereitlegen, sobald sich das Bild ändert.
  useEffect(() => {
    if (!ready) return;
    try {
      if (state.settings.personalPhoto)
        localStorage.setItem(PHOTO_KEY, state.settings.personalPhoto);
      else localStorage.removeItem(PHOTO_KEY);
      localStorage.setItem(CAPTION_KEY, state.settings.personalCaption);
    } catch {
      // Ohne Kopie startet der Planer eben ohne Bild – kein Beinbruch.
    }
  }, [ready, state.settings.personalPhoto, state.settings.personalCaption]);

  // Den Startbildschirm noch kurz stehen lassen, damit er weich verschwindet.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setStartVisible(false), 420);
    return () => clearTimeout(timer);
  }, [ready]);

  // Beim Wegwischen oder Schließen den ausstehenden Stand sofort sichern,
  // statt auf das verzögerte Speichern zu warten.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushPersistence();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushPersistence);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushPersistence);
    };
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
      else if (e.key === 'e') setView('shopping');
      else if (e.key === 'u') setView('vacation');
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

  const activeMembers = useMemo(
    () => new Set(state.members.filter((m) => !hiddenMembers.has(m.id)).map((m) => m.id)),
    [state.members, hiddenMembers],
  );

  /*
   * Der Personenfilter greift zusätzlich zum Bereichsfilter. Einträge ohne
   * Zuordnung bleiben immer sichtbar – siehe domain/people.
   */
  const visibleBlocks = useMemo(
    () => state.blocks.filter((b) => matchesMembers(blockMemberIds(b, state.tasks), activeMembers)),
    [state.blocks, state.tasks, activeMembers],
  );

  /* ------------------------------------------------------------ Ablegen */

  const handleDrop = useCallback(
    (payload: DragPayload, target: DropTarget) => {
      const { dayStartMin, dayEndMin, slotMin } = state.settings;
      const limit = (value: number) => clamp(value, dayStartMin, dayEndMin - slotMin);

      if (target.kind === 'pool') {
        if (payload.kind !== 'block') return;
        const block = state.blocks.find((b) => b.id === payload.blockId);
        // Feste Termine haben keine Aufgabe, die in den Pool zurückkönnte.
        if (block?.taskId) unscheduleTask(block.taskId);
        return;
      }

      if (target.kind === 'day') {
        if (payload.kind === 'task') scheduleTask(payload.taskId, target.date);
        else updateBlock(payload.blockId, { date: target.date });
        return;
      }

      if (payload.kind === 'task') {
        scheduleTask(payload.taskId, target.date, limit(target.startMin));
      } else {
        updateBlock(payload.blockId, {
          date: target.date,
          startMin: limit(snap(target.startMin - payload.grabOffsetMin, slotMin)),
        });
      }
    },
    [state.blocks, state.settings],
  );

  /* -------------------------------------------------------------- Sprache */

  const acceptVoice = useCallback(
    (parsed: Parsed) => {
      const contextId = state.contexts[0]?.id ?? '';
      if (parsed.kind === 'shopping') {
        addShoppingItems(parsed.items.map((item) => ({ ...item, createdBy: sync.displayName })));
        setView('shopping');
        return;
      }
      if (parsed.kind === 'appointment') {
        addFixedBlock({
          date: parsed.date,
          startMin: parsed.startMin,
          durationMin: parsed.durationMin,
          title: parsed.title,
          contextId,
          memberIds: parsed.memberIds,
        });
        setDate(parsed.date);
        return;
      }
      addTask({
        title: parsed.title,
        contextId,
        estimateMin: parsed.estimateMin ?? 30,
        dueDate: parsed.date,
        memberIds: parsed.memberIds,
      });
      if (compact) setDayPane('pool');
    },
    [state.contexts, sync.displayName, compact],
  );

  /* ----------------------------------------------------------- Kennzahlen */

  const dayBlocks = useMemo(
    () => visibleBlocks.filter((b) => b.date === date && activeContexts.has(b.contextId)),
    [visibleBlocks, date, activeContexts],
  );

  // Feiertage und Abwesenheiten des gezeigten Tages – der Tagesplan soll
  // nicht so tun, als wäre ein Urlaubstag ein Arbeitstag.
  const holidays = useMemo(
    () =>
      holidayMap(
        [Number(date.slice(0, 4)) - 1, Number(date.slice(0, 4)), Number(date.slice(0, 4)) + 1],
        state.settings.bundesland as Bundesland,
      ),
    [date, state.settings.bundesland],
  );
  const dayHoliday = holidays.get(date) ?? null;
  const dayAbsences = useMemo(() => absencesOn(state.absences, date), [state.absences, date]);

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

  const pool = useMemo(
    () => backlogTasks(state).filter((t) => matchesMembers(memberIdsOf(t), activeMembers)),
    [state, activeMembers],
  );
  const openShopping = state.shopping.filter((item) => !item.done).length;
  const defaultContextId = state.contexts[0]?.id ?? '';

  const backlog = (
    <Backlog
      tasks={pool}
      contexts={state.contexts}
      members={state.members}
      activeContexts={activeContexts}
      targetDate={date}
      today={today}
      onEditTask={(task) => setDialog({ kind: 'task', task })}
      onNewTask={() => setDialog({ kind: 'task', task: null })}
    />
  );

  const start = startVisible ? (
    <StartScreen
      photo={ready ? state.settings.personalPhoto : startPhoto.photo}
      caption={ready ? state.settings.personalCaption : startPhoto.caption}
      ready={ready}
    />
  ) : null;

  if (!ready) return start;

  return (
    <DragProvider onDrop={handleDrop}>
      {start}
      <div className={`app${compact ? ' compact' : ''}`}>
        <header className="topbar">
          <div className="brand">
            <span className="logo" aria-hidden />
            <h1>Tagesplaner</h1>
          </div>

          {!compact && (
            <nav className="tabs" aria-label="Ansicht">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  className={`tab${view === key ? ' on' : ''}`}
                  onClick={() => setView(key)}
                >
                  {label}
                  {key === 'shopping' && openShopping > 0 && (
                    <span className="tab-badge">{openShopping}</span>
                  )}
                </button>
              ))}
            </nav>
          )}

          <div className="topbar-right">
            <SyncBar sync={sync} compact={compact} />
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
            {/*
              Das Mikrofon sitzt in der Leiste, die sich Tag und Woche teilen –
              so ist es in beiden Ansichten an derselben Stelle erreichbar.
            */}
            <VoiceCapture
              mode="plan"
              members={state.members}
              today={today}
              onAccept={acceptVoice}
              label="Termin oder Aufgabe diktieren"
            />
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
                  ? `KW ${isoWeekNumber(date)}${compact ? '' : ` · ab ${formatDateLong(weekDates(date)[0])}`}`
                  : compact
                    ? `${formatDateShort(date)}`
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

            {state.members.length > 0 && (
              <div className="filters">
                {state.members.map((member) => {
                  const on = !hiddenMembers.has(member.id);
                  return (
                    <button
                      key={member.id}
                      className={`chip person${on ? ' on' : ''}`}
                      style={{ '--accent': member.color } as React.CSSProperties}
                      title={`Nur ${member.name} zeigen oder ausblenden`}
                      onClick={() =>
                        setHiddenMembers((current) => {
                          const next = new Set(current);
                          if (next.has(member.id)) next.delete(member.id);
                          else next.add(member.id);
                          return next;
                        })
                      }
                    >
                      <span className="dot" />
                      {member.name}
                    </button>
                  );
                })}
              </div>
            )}

            {view === 'day' && (
              <div className="day-stats">
                <div className="load-bar wide" title={`${load}% der Tageskapazität verplant`}>
                  <div
                    className={`load-fill${planned > state.settings.capacityMin ? ' over' : ''}`}
                    style={{ width: `${Math.min(100, load)}%` }}
                  />
                </div>
                <span className="muted small">
                  {formatDuration(planned)} von {formatDuration(state.settings.capacityMin)} ·{' '}
                  {doneCount} erledigt · {openCount} offen
                </span>
              </div>
            )}
          </div>
        )}

        {compact && view === 'day' && (
          <div className="segmented" role="tablist">
            <button
              className={dayPane === 'plan' ? 'on' : ''}
              role="tab"
              aria-selected={dayPane === 'plan'}
              onClick={() => setDayPane('plan')}
            >
              Tagesplan
            </button>
            <button
              className={dayPane === 'pool' ? 'on' : ''}
              role="tab"
              aria-selected={dayPane === 'pool'}
              onClick={() => setDayPane('pool')}
            >
              Pool ({pool.length})
            </button>
          </div>
        )}

        <main className={`content view-${view}`}>
          {view === 'day' && (
            <>
              {(!compact || dayPane === 'pool') && backlog}
              {(!compact || dayPane === 'plan') && (
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
                      + Termin
                    </button>
                    {rolloverCount > 0 && (
                      <button
                        className="btn ghost"
                        title="Nicht erledigte Aufgaben vom Vortag auf diesen Tag ziehen"
                        onClick={() => rolloverOpenTasks(yesterday, date)}
                      >
                        {rolloverCount} vom Vortag
                      </button>
                    )}
                    <span className="spacer" />
                    <span className="muted small hide-narrow">
                      Am Griff ziehen · Doppelklick legt einen Termin an
                    </span>
                  </div>
                  {(dayHoliday || dayAbsences.length > 0) && (
                    <div className="day-notice">
                      {dayHoliday && <span className="notice-tag holiday">{dayHoliday}</span>}
                      {dayAbsences.map((absence) => {
                        const member = state.members.find((m) => m.id === absence.memberId);
                        return (
                          <span
                            key={absence.id}
                            className="notice-tag"
                            style={{ '--accent': member?.color } as React.CSSProperties}
                          >
                            <span className="dot" />
                            {member?.name}: {ABSENCE_LABELS[absence.kind]}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <DayTimeline
                    date={date}
                    today={today}
                    blocks={visibleBlocks.filter((b) => b.date === date)}
                    tasks={state.tasks}
                    contexts={state.contexts}
                    members={state.members}
                    activeContexts={activeContexts}
                    settings={state.settings}
                    onEditBlock={(block) =>
                      setDialog({ kind: 'block', block, startMin: block.startMin })
                    }
                    onEditTask={(task) => setDialog({ kind: 'task', task })}
                    onNewBlockAt={(startMin) => setDialog({ kind: 'block', block: null, startMin })}
                  />
                </div>
              )}
            </>
          )}

          {view === 'week' && (
            <>
              {!compact && backlog}
              <WeekView
                state={state}
                blocks={visibleBlocks}
                anchorDate={date}
                today={today}
                activeContexts={activeContexts}
                holidays={holidays}
                onOpenDay={(d) => {
                  setDate(d);
                  setView('day');
                }}
                onEditTask={(task) => setDialog({ kind: 'task', task })}
                onEditBlock={(block) =>
                  setDialog({ kind: 'block', block, startMin: block.startMin })
                }
              />
            </>
          )}

          {view === 'vacation' &&
            (openTripId ? (
              <TripView state={state} tripId={openTripId} onBack={() => setOpenTripId(null)} />
            ) : (
              <VacationView
                state={state}
                today={today}
                onOpenTrip={(id) => setOpenTripId(id)}
                onNewTrip={(absence) => {
                  const trip = addTrip({
                    title: 'Neue Reise',
                    destination: '',
                    startDate: absence.startDate,
                    endDate: absence.endDate,
                    notes: '',
                  });
                  updateAbsence(absence.id, { tripId: trip.id });
                  setOpenTripId(trip.id);
                }}
              />
            ))}

          {view === 'shopping' && (
            <ShoppingView
              items={state.shopping}
              today={today}
              displayName={sync.displayName}
              priceMemory={state.settings.priceMemory}
            />
          )}

          {view === 'series' && (
            <SeriesView
              series={state.series}
              contexts={state.contexts}
              onEdit={(series) => setDialog({ kind: 'series', series })}
              onNew={() => setDialog({ kind: 'series', series: null })}
            />
          )}

          {view === 'settings' && <SettingsView state={state} sync={sync} />}
        </main>

        {compact && (
          <nav className="tabbar" aria-label="Ansicht">
            {TABS.map(([key, label, icon]) => (
              <button
                key={key}
                className={view === key ? 'on' : ''}
                onClick={() => setView(key)}
                aria-current={view === key}
              >
                <span className="tabbar-icon" aria-hidden>
                  {icon}
                </span>
                {label}
                {key === 'shopping' && openShopping > 0 && (
                  <span className="tab-badge">{openShopping}</span>
                )}
              </button>
            ))}
          </nav>
        )}

        <UpdateBanner update={update} />

        {dialog?.kind === 'task' && (
          <TaskDialog
            task={dialog.task}
            contexts={state.contexts}
            members={state.members}
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
            members={state.members}
            tasks={state.tasks}
            defaultContextId={defaultContextId}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog?.kind === 'series' && (
          <SeriesDialog
            series={dialog.series}
            contexts={state.contexts}
            members={state.members}
            defaultContextId={defaultContextId}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog?.kind === 'help' && (
          <Modal title="Kurzhilfe" onClose={() => setDialog(null)}>
            <ul className="help-list">
              <li>
                <b>Einplanen:</b> Aufgabe am Griff (⠿) auf die Zeitachse ziehen – das geht mit Maus
                und Finger. Oder „Einplanen" tippen, dann sucht der Planer die nächste freie Lücke.
              </li>
              <li>
                <b>Verschieben:</b> Blöcke am linken Griff ziehen; am unteren Rand ziehen ändert die
                Dauer.
              </li>
              <li>
                <b>Sprache:</b> 🎤 antippen und sprechen – „morgen um 15 Uhr Zahnarzt" wird zum
                Termin, „zwei Liter Milch und Brot für 3 Euro" landet auf der Einkaufsliste. Vor dem
                Übernehmen siehst du, was verstanden wurde.
              </li>
              <li>
                <b>Zurück in den Pool:</b> ↩ am Block, oder den Block auf den Pool ziehen.
              </li>
              <li>
                <b>Tastatur:</b> <kbd>←</kbd>/<kbd>→</kbd> blättern, <kbd>t</kbd> heute,{' '}
                <kbd>d</kbd> Tag, <kbd>w</kbd> Woche, <kbd>e</kbd> Einkauf, <kbd>n</kbd> neue
                Aufgabe.
              </li>
            </ul>
          </Modal>
        )}
      </div>
    </DragProvider>
  );
}
