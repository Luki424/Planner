import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Backlog } from './components/Backlog';
import { MemberDots } from './components/MemberPicker';
import { BlockDialog } from './components/BlockDialog';
import { DayTimeline } from './components/DayTimeline';
import { Modal } from './components/Modal';
import { SeriesDialog } from './components/SeriesDialog';
import { SeriesView } from './components/SeriesView';
import { SettingsView } from './components/SettingsView';
import { StartScreen } from './components/StartScreen';
import { TodoView } from './components/TodoView';
import { BalanceView } from './components/BalanceView';
import { AssistantView } from './components/AssistantView';
import { AssistantBubble } from './components/AssistantBubble';
import { SearchOverlay } from './components/SearchOverlay';
import { ShoppingView, type ShoppingKarte } from './components/ShoppingView';
import { SyncBar } from './components/SyncBar';
import { TaskDialog } from './components/TaskDialog';
import { TripView } from './components/TripView';
import { UndoBar } from './components/UndoBar';
import { ReminderBar } from './components/ReminderBar';
import { UpdateBanner } from './components/UpdateBanner';
import { VacationView } from './components/VacationView';
import { VoiceCapture } from './components/VoiceCapture';
import { MonthView } from './components/MonthView';
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
import {
  KIND_ICONS,
  describeLead,
  describeOccurrence,
  dueNotices,
  occurrencesOn,
} from './domain/anniversaries';
import { holidayMap, type Bundesland } from './domain/holidays';
import { monthGrid, monthLabel, monthLabelShort, shiftMonthByDate } from './domain/month';
import { nextChoice } from './domain/theme';
import { ABSENCE_LABELS, absencesOn } from './domain/leave';
import { blockMemberIds, matchesMembers, memberIdsOf } from './domain/people';
import { clamp, plannedMinutes, snap } from './domain/scheduling';
import type { AppState, Block, ID, Series, Task } from './domain/types';
import type { Parsed } from './domain/voice';
import { type DragPayload, type DropTarget } from './hooks/dragContext';
import { DragProvider } from './hooks/useDragDrop';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useTheme } from './hooks/useTheme';
import { useCalendarFeed } from './hooks/useCalendarFeed';
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
  setTrashAuthor,
  unscheduleTask,
  updateAbsence,
  updateBlock,
  useAppState,
} from './storage/store';

type View = 'day' | 'week' | 'todo' | 'shopping' | 'vacation' | 'settings';

/** Synchron lesbare Kopie für den Startbildschirm. */
const PHOTO_KEY = 'planner:photo';
const CAPTION_KEY = 'planner:caption';
const WEEK_POOL_KEY = 'planner:wochenpool';

type Dialog =
  | { kind: 'task'; task: Task | null }
  | { kind: 'block'; block: Block | null; startMin: number }
  | { kind: 'series'; series: Series | null }
  | { kind: 'help' }
  | null;

const TABS: Array<[View, string, string]> = [
  ['day', 'Tag', '📅'],
  ['week', 'Woche', '🗓️'],
  ['todo', 'Liste', '📋'],
  ['shopping', 'Einkauf', '🛒'],
  ['vacation', 'Urlaub', '🌴'],
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
   * Serien sind wiederkehrende Aufgaben und gehören deshalb zur Aufgabenliste,
   * nicht in einen eigenen Reiter – so bleibt die Navigation bei sechs Punkten.
   */
  const [todoPane, setTodoPane] = useState<'offen' | 'serien'>('offen');
  /*
   * Woche und Monat sind dieselbe Frage in zwei Auflösungen und teilen sich
   * deshalb einen Reiter. Ein siebter Punkt in der Navigationsleiste wäre am
   * Handy nur noch 59 px breit.
   */
  const [weekPane, setWeekPane] = useState<'woche' | 'monat' | 'bilanz'>('woche');
  const [shoppingKarte, setShoppingKarte] = useState<ShoppingKarte>('liste');
  const [sucheOffen, setSucheOffen] = useState(false);
  const [assistentOffen, setAssistentOffen] = useState(false);
  /*
   * Eine Frage, die beim Öffnen gleich hinausgeht. Kommt vom Weckwort:
   * „Hey Planer, was steht Donnerstag an" soll nicht nur aufmachen.
   */
  const [assistentFrage, setAssistentFrage] = useState<string | undefined>(undefined);
  const assistentOeffnen = useCallback((frage?: string) => {
    setAssistentFrage(frage);
    setAssistentOffen(true);
  }, []);
  /*
   * Der Aufgabenpool über der Woche. Standardmäßig zu – offen nimmt er der
   * Woche Höhe weg, und meistens will man dort nur schauen. Die Wahl bleibt
   * auf dem Gerät, damit man sie nicht bei jedem Besuch neu trifft.
   */
  const [weekPoolOpen, setWeekPoolOpen] = useState(() => {
    try {
      return localStorage.getItem(WEEK_POOL_KEY) === 'offen';
    } catch {
      return false;
    }
  });
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
  const theme = useTheme();
  /*
   * Der abonnierte Arbeitskalender. Läuft beim Öffnen, wenn eine Woche um
   * ist – mehr geht ohne Server nicht, und das steht auch so an der
   * Einstellung.
   */
  useCalendarFeed(state, today, ready);

  /*
   * Der Tastaturgriff soll immer die aktuelle Wahl umschalten, ohne dass die
   * Tastenbelegung bei jedem Wechsel neu registriert werden muss.
   */
  const themeRef = useRef(() => {});
  themeRef.current = () => theme.setChoice(nextChoice(theme.choice, theme.mode === 'light'));

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

  /*
   * Wer löscht, steht am Papierkorb-Eintrag. Der Store kennt die Anmeldung
   * nicht – sie wird ihm gesagt, statt ihn davon abhängig zu machen.
   */
  useEffect(() => {
    setTrashAuthor(sync.displayName);
  }, [sync.displayName]);

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

  useEffect(() => {
    try {
      localStorage.setItem(WEEK_POOL_KEY, weekPoolOpen ? 'offen' : 'zu');
    } catch {
      // Ohne Gedächtnis startet der Streifen eben zu – kein Beinbruch.
    }
  }, [weekPoolOpen]);

  // Ein über Mitternacht offener Tab soll trotzdem den richtigen Tag als "heute" führen.
  useEffect(() => {
    const timer = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const monatsansicht = view === 'week' && weekPane === 'monat';
  const bilanzansicht = view === 'week' && weekPane === 'bilanz';

  /** Ein Klick auf ‹ oder › springt um das, was gerade zu sehen ist. */
  const blaettern = useCallback(
    (richtung: 1 | -1) =>
      setDate((d) =>
        monatsansicht
          ? shiftMonthByDate(d, richtung)
          : addDays(d, view === 'week' ? 7 * richtung : richtung),
      ),
    [monatsansicht, view],
  );

  const visibleDates = useMemo(
    () =>
      monatsansicht ? monthGrid(date).flat() : view === 'week' ? weekDates(date) : [date, today],
    [monatsansicht, view, date, today],
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
      if (e.key === 'ArrowLeft') blaettern(-1);
      else if (e.key === 'ArrowRight') blaettern(1);
      else if (e.key === 't') setDate(todayISO());
      else if (e.key === 'd') setView('day');
      else if (e.key === 'w') {
        setView('week');
        setWeekPane('woche');
      } else if (e.key === 'm') {
        setView('week');
        setWeekPane('monat');
      } else if (e.key === 'e') setView('shopping');
      else if (e.key === 'u') setView('vacation');
      else if (e.key === 'l') setView('todo');
      else if (e.key === 'h') themeRef.current();
      else if (e.key === 'n') {
        e.preventDefault();
        setDialog({ kind: 'task', task: null });
      } else if (e.key === '?') setDialog({ kind: 'help' });
      else if (e.key === '/') {
        // Wie überall: Schrägstrich öffnet die Suche.
        e.preventDefault();
        setSucheOffen(true);
      } else if (e.key === 'k') {
        // „k" wie Klönen – „a" wäre schon dreimal vergeben.
        e.preventDefault();
        assistentOeffnen();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [view, blaettern, assistentOeffnen]);

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

  /*
   * Jahrestage des gezeigten Tages – und, solange man auf heute schaut, auch
   * die angekündigten. Ein Geburtstag nützt wenig, wenn man ihn erst am Tag
   * selbst sieht; die Ankündigung gehört deshalb dorthin, wo man morgens
   * ohnehin hinschaut.
   */
  const dayAnniversaries = useMemo(
    () =>
      date === today
        ? dueNotices(state.anniversaries, date)
        : occurrencesOn(state.anniversaries, date),
    [state.anniversaries, date, today],
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
            {/*
              Der Suchknopf steht auch am Handy in der Kopfzeile: Suchen ist
              kein Ort, sondern ein Weg – ein eigener Reiter wäre falsch.
            */}
            <button
              className="icon-btn"
              onClick={() => setSucheOffen(true)}
              title="Suchen (/)"
              aria-label="Suchen"
            >
              🔍
            </button>
            <SyncBar sync={sync} compact={compact} />
            <button
              className="icon-btn theme-toggle"
              onClick={() => theme.setChoice(nextChoice(theme.choice, theme.mode === 'light'))}
              title={`Umschalten auf ${theme.mode === 'dark' ? 'hell' : 'dunkel'}`}
              aria-label={`Erscheinungsbild umschalten, gerade ${
                theme.mode === 'dark' ? 'dunkel' : 'hell'
              }`}
            >
              {theme.mode === 'dark' ? '☀' : '☾'}
            </button>
            <button
              className="btn ghost"
              onClick={() => setDialog({ kind: 'help' })}
              title="Kurzhilfe"
            >
              ?
            </button>
          </div>
        </header>

        {(view === 'day' || view === 'week' || view === 'todo') && (
          <div className={`subbar${view === 'todo' ? ' bare' : ''}`}>
            {/*
              Das Mikrofon sitzt in der Leiste, die sich Tag und Woche teilen –
              so ist es in beiden Ansichten an derselben Stelle erreichbar.
            */}
            <VoiceCapture
              mode="plan"
              members={state.members}
              today={today}
              onAccept={acceptVoice}
              label={view === 'todo' ? 'Erledigung diktieren' : 'Termin oder Aufgabe diktieren'}
            />
            {/*
              In der Bilanz gibt es nichts zu blättern – der Zeitraum wird
              dort gewählt, und „KW 32" wäre schlicht falsch.
            */}
            {view !== 'todo' && !bilanzansicht && (
              <div className="date-nav">
                <button className="icon-btn" onClick={() => blaettern(-1)} aria-label="Zurück">
                  ‹
                </button>
                <button className="btn ghost" onClick={() => setDate(today)}>
                  Heute
                </button>
                <button className="icon-btn" onClick={() => blaettern(1)} aria-label="Weiter">
                  ›
                </button>
                <strong className="current-date">
                  {monatsansicht
                    ? compact
                      ? monthLabelShort(date)
                      : monthLabel(date)
                    : view === 'week'
                      ? `KW ${isoWeekNumber(date)}${compact ? '' : ` · ab ${formatDateLong(weekDates(date)[0])}`}`
                      : compact
                        ? `${formatDateShort(date)}`
                        : formatDateLong(date)}
                </strong>
                {date === today && <span className="badge">heute</span>}
              </div>
            )}

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
                  {(dayHoliday || dayAbsences.length > 0 || dayAnniversaries.length > 0) && (
                    <div className="day-notice">
                      {dayHoliday && <span className="notice-tag holiday">{dayHoliday}</span>}
                      {dayAnniversaries.map((o) => (
                        <span key={o.anniversary.id} className="notice-tag anniversary">
                          <span aria-hidden="true">{KIND_ICONS[o.anniversary.kind]}</span>
                          {describeOccurrence(o)}
                          {o.inDays > 0 && <em> · {describeLead(o.inDays)}</em>}
                          <MemberDots memberIds={o.anniversary.memberIds} members={state.members} />
                        </span>
                      ))}
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
              {/*
                Kein Aufgabenpool daneben – weder im Monat noch in der Woche.
                Er belegte 370 der 1440 Pixel, und was blieb, teilten sich
                sieben Spalten: für den Titel eines Termins waren es am Ende
                75 Pixel. „Zahnarzttermin Dr. Berger" ist darin bei keiner
                Schriftgröße lesbar. Ohne ihn hat jede Spalte 186 statt 135.
                Eingeplant wird im Tag und auf der Liste; ein Klick auf den
                Wochentag führt dorthin.
              */}
              <div className={`week-wrap${monatsansicht || bilanzansicht ? ' is-month' : ''}`}>
                <div className="segmented inline week-tabs" role="tablist">
                  <button
                    className={weekPane === 'woche' ? 'on' : ''}
                    role="tab"
                    aria-selected={weekPane === 'woche'}
                    onClick={() => setWeekPane('woche')}
                  >
                    Woche
                  </button>
                  <button
                    className={weekPane === 'monat' ? 'on' : ''}
                    role="tab"
                    aria-selected={weekPane === 'monat'}
                    onClick={() => setWeekPane('monat')}
                  >
                    Monat
                  </button>
                  {/*
                    Dritte Karte: dieselbe Frage in noch gröberer Auflösung –
                    nicht „was steht an", sondern „wohin ging die Zeit".
                  */}
                  <button
                    className={weekPane === 'bilanz' ? 'on' : ''}
                    role="tab"
                    aria-selected={weekPane === 'bilanz'}
                    onClick={() => setWeekPane('bilanz')}
                  >
                    Bilanz
                  </button>
                </div>

                {/*
                  Nur in der Woche: dort zieht man Aufgaben auf einen Tag.
                  Im Monat gibt es keine Ablagefläche dafür.
                */}
                {!monatsansicht && !bilanzansicht && (
                  <button
                    className="btn ghost week-pool-toggle"
                    aria-expanded={weekPoolOpen}
                    onClick={() => setWeekPoolOpen((offen) => !offen)}
                  >
                    {weekPoolOpen ? '▴' : '▾'} Aufgabenpool
                    {!weekPoolOpen && pool.length > 0 && (
                      <span className="chip-count">{pool.length}</span>
                    )}
                  </button>
                )}

                {!monatsansicht && !bilanzansicht && weekPoolOpen && (
                  <Backlog
                    tasks={pool}
                    contexts={state.contexts}
                    members={state.members}
                    activeContexts={activeContexts}
                    targetDate={date}
                    today={today}
                    variant="strip"
                    onEditTask={(task) => setDialog({ kind: 'task', task })}
                    onNewTask={() => setDialog({ kind: 'task', task: null })}
                  />
                )}

                {bilanzansicht ? (
                  <BalanceView
                    state={state}
                    blocks={visibleBlocks}
                    today={today}
                    activeContexts={activeContexts}
                  />
                ) : monatsansicht ? (
                  <MonthView
                    state={state}
                    blocks={visibleBlocks}
                    anchorDate={date}
                    today={today}
                    activeContexts={activeContexts}
                    holidays={holidays}
                    // Am Handy ist ein Feld rund 55 px breit; mehr als zwei
                    // Zeilen wären dort nur noch Streifen.
                    maxPerDay={compact ? 2 : 4}
                    onOpenDay={(d) => {
                      setDate(d);
                      setView('day');
                    }}
                    onOpenWeek={(d) => {
                      setDate(d);
                      setWeekPane('woche');
                    }}
                  />
                ) : (
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
                )}
              </div>
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
              state={state}
              karte={shoppingKarte}
              onKarte={setShoppingKarte}
            />
          )}

          {view === 'todo' && (
            <>
              <div className="segmented inline todo-tabs" role="tablist">
                <button
                  className={todoPane === 'offen' ? 'on' : ''}
                  role="tab"
                  aria-selected={todoPane === 'offen'}
                  onClick={() => setTodoPane('offen')}
                >
                  Zu erledigen
                </button>
                <button
                  className={todoPane === 'serien' ? 'on' : ''}
                  role="tab"
                  aria-selected={todoPane === 'serien'}
                  onClick={() => setTodoPane('serien')}
                >
                  Wiederkehrend
                </button>
              </div>
              {todoPane === 'offen' ? (
                <TodoView
                  state={state}
                  today={today}
                  activeContexts={activeContexts}
                  targetDate={date}
                  onEditTask={(task) => setDialog({ kind: 'task', task })}
                />
              ) : (
                <SeriesView
                  series={state.series}
                  contexts={state.contexts}
                  onEdit={(series) => setDialog({ kind: 'series', series })}
                  onNew={() => setDialog({ kind: 'series', series: null })}
                />
              )}
            </>
          )}

          {view === 'settings' && <SettingsView state={state} sync={sync} theme={theme} />}
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
        <UndoBar state={state} />

        {sucheOffen && (
          <SearchOverlay
            state={state}
            today={today}
            onClose={() => setSucheOffen(false)}
            onOpen={(ziel) => {
              /*
               * Ein Treffer führt dorthin, wo er steht – samt Datum und
               * Karteikarte. Ein Suchergebnis, das nur die Ansicht wechselt
               * und den Benutzer weitersuchen lässt, hilft nicht.
               */
              setView(ziel.view);
              if (ziel.view === 'day') setDate(ziel.date);
              if (ziel.view === 'shopping') setShoppingKarte(ziel.karte);
            }}
          />
        )}

        {assistentOffen && (
          <AssistantView
            state={state}
            today={today}
            displayName={sync.displayName}
            startFrage={assistentFrage}
            onClose={() => {
              setAssistentOffen(false);
              setAssistentFrage(undefined);
            }}
          />
        )}

        {/*
          Die Blase liegt über den Ansichten, aber unter den Dialogen: Wer
          einen Termin bearbeitet, fragt gerade nicht den Assistenten – und
          sie verdeckte dort „Speichern".
        */}
        <AssistantBubble offen={assistentOffen} onOeffnen={assistentOeffnen} />

        <ReminderBar state={state} today={today} />

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
                <b>Assistent:</b> 💬 antippen und fragen – „was steht Donnerstag an" oder „Zahnarzt
                am Dienstag um zehn". Eingetragen wird erst, wenn du den Vorschlag bestätigst. Der
                Zugang wird einmal unter „Mehr" eingerichtet und bleibt auf diesem Gerät.
              </li>
              <li>
                <b>Tastatur:</b> <kbd>←</kbd>/<kbd>→</kbd> blättern, <kbd>t</kbd> heute,{' '}
                <kbd>d</kbd> Tag, <kbd>w</kbd> Woche, <kbd>m</kbd> Monat, <kbd>l</kbd> Liste,{' '}
                <kbd>e</kbd> Einkauf, <kbd>n</kbd> neue Aufgabe, <kbd>/</kbd> suchen, <kbd>k</kbd>{' '}
                fragen.
              </li>
            </ul>
          </Modal>
        )}
      </div>
    </DragProvider>
  );
}
