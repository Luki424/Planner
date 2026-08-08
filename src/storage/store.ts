import { useSyncExternalStore } from 'react';
import { addDays, today } from '../domain/dates';
import { seriesOccursOn } from '../domain/recurrence';
import { rememberPrice } from '../domain/prices';
import { blockEnd, findFreeSlot } from '../domain/scheduling';
import type {
  Absence,
  AbsenceKind,
  Anniversary,
  AppState,
  Block,
  Context,
  ID,
  LeaveYear,
  Member,
  Series,
  Settings,
  ShoppingItem,
  SyncedCollection,
  Task,
  TaskList,
  Expense,
  RecurringExpense,
  RecurringInterval,
  MealEntry,
  MealSlot,
  Recipe,
  RecipeIngredient,
  Trip,
  TripItem,
  TripItemKind,
} from '../domain/types';

export const STATE_VERSION = 1;

const newId = (): ID =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function initialState(): AppState {
  const work: Context = { id: newId(), name: 'Beruflich', color: '#3b82f6' };
  const personal: Context = { id: newId(), name: 'Privat', color: '#10b981' };
  return {
    version: STATE_VERSION,
    contexts: [work, personal],
    taskLists: [],
    tasks: [],
    blocks: [],
    series: [],
    shopping: [],
    members: [],
    absences: [],
    leaveYears: [],
    anniversaries: [],
    trips: [],
    tripItems: [],
    recipes: [],
    recipeIngredients: [],
    meals: [],
    expenses: [],
    recurringExpenses: [],
    settings: {
      dayStartMin: 6 * 60,
      dayEndMin: 22 * 60,
      slotMin: 15,
      capacityMin: 8 * 60,
      priceMemory: {},
      personalPhoto: null,
      personalCaption: '',
      bundesland: 'NW',
    },
  };
}

let state: AppState = initialState();
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let persist: ((s: AppState) => void) | null = null;
let persistSync: ((s: AppState) => void) | null = null;

/** Wird einmalig beim Start gesetzt, damit der Store nichts über IndexedDB wissen muss. */
export function configurePersistence(fn: (s: AppState) => void, syncFn?: (s: AppState) => void) {
  persist = fn;
  persistSync = syncFn ?? null;
}

function set(updater: (current: AppState) => AppState) {
  state = updater(state);
  emit();
  if (!hydrated || !persist) return;
  if (saveTimer) clearTimeout(saveTimer);
  const snapshot = state;
  saveTimer = setTimeout(() => persist?.(snapshot), 250);
}

/**
 * Schreibt einen ausstehenden Stand sofort weg.
 *
 * Das Sichern ist um einige Hundert Millisekunden verzögert, damit nicht jeder
 * Tastendruck in die Datenbank geht. Wird der Tab in genau dieser Spanne
 * geschlossen oder weggewischt, wäre die letzte Änderung verloren – am Handy
 * passiert das leicht. Deshalb hängt die App diesen Aufruf an das Ausblenden
 * der Seite.
 */
export function flushPersistence() {
  if (!hydrated) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  // Zuerst synchron: der asynchrone Weg käme beim Abbau der Seite zu spät.
  persistSync?.(state);
  persist?.(state);
}

export function hydrate(loaded: AppState | null) {
  if (loaded && loaded.version === STATE_VERSION) {
    // Fehlende Felder aus späteren Versionen tolerant auffüllen.
    state = {
      ...initialState(),
      ...loaded,
      settings: {
        ...initialState().settings,
        ...loaded.settings,
        // Aus älteren Ständen fehlen diese Felder noch.
        priceMemory: loaded.settings?.priceMemory ?? {},
        personalPhoto: loaded.settings?.personalPhoto ?? null,
        personalCaption: loaded.settings?.personalCaption ?? '',
        bundesland: loaded.settings?.bundesland ?? 'NW',
      },
      // Zuordnungen gibt es erst seit "wer macht was"; ältere Stände haben sie nicht.
      tasks: (loaded.tasks ?? []).map((t) => ({
        ...t,
        memberIds: t.memberIds ?? [],
        listId: t.listId ?? null,
        // Ganztägig gibt es erst seit später; alles Ältere hatte eine Dauer.
        allDay: t.allDay ?? false,
      })),
      blocks: (loaded.blocks ?? []).map((b) => ({
        ...b,
        memberIds: b.memberIds ?? [],
        allDay: b.allDay ?? false,
      })),
      series: (loaded.series ?? []).map((s) => ({
        ...s,
        skipped: s.skipped ?? [],
        memberIds: s.memberIds ?? [],
        allDay: s.allDay ?? false,
      })),
    };
  }
  hydrated = true;
  emit();
}

export function isHydrated() {
  return hydrated;
}

export function getState(): AppState {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Für Nicht-React-Hörer wie die Sync-Schicht. */
export function subscribeToStore(listener: () => void): () => void {
  return subscribe(listener);
}

/**
 * Übernimmt eine Sammlung so, wie sie auf dem Server steht.
 * Der Server ist bei aktiver Synchronisation die Wahrheit; Firestore liefert
 * eigene, noch nicht bestätigte Änderungen bereits in seinen Momentaufnahmen
 * mit, sodass dabei nichts Lokales verloren geht.
 */
export function applyRemoteCollection(name: SyncedCollection, entities: Array<{ id: ID }>) {
  // Firestore liefert Dokumente in Schlüsselreihenfolge, also praktisch
  // zufällig. Ohne feste Sortierung stünden Bereiche und Einträge auf jedem
  // Gerät anders – und "der erste Bereich" wäre mal Privat, mal Beruflich.
  const ordered =
    name === 'contexts'
      ? [...(entities as Context[])].sort(byName)
      : name === 'shopping'
        ? [...(entities as ShoppingItem[])].sort(byCreatedAt)
        : entities;
  // Dokumente, die ein Gerät mit älterem Stand geschrieben hat, führen noch
  // keine Zuordnung. Ohne dieses Auffüllen käme sie als undefined zurück.
  const normalized =
    name === 'tasks' || name === 'blocks' || name === 'series'
      ? ordered.map((e) => ({ ...e, memberIds: (e as { memberIds?: ID[] }).memberIds ?? [] }))
      : ordered;
  set((s) => ({ ...s, [name]: normalized as AppState[SyncedCollection] }));
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'de');

const byCreatedAt = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

export function applyRemoteSettings(settings: Settings) {
  set((s) => ({
    ...s,
    settings: {
      ...s.settings,
      ...settings,
      priceMemory: settings.priceMemory ?? {},
      personalPhoto: settings.personalPhoto ?? null,
      personalCaption: settings.personalCaption ?? '',
      bundesland: settings.bundesland ?? 'NW',
    },
  }));
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/* ------------------------------------------------------------------ Aufgaben */

export type NewTaskInput = {
  title: string;
  contextId: ID;
  estimateMin?: number;
  allDay?: boolean;
  notes?: string;
  dueDate?: string | null;
  memberIds?: ID[];
  listId?: ID | null;
};

export function addTask(input: NewTaskInput): Task {
  const task: Task = {
    id: newId(),
    title: input.title.trim(),
    notes: input.notes ?? '',
    contextId: input.contextId,
    estimateMin: input.estimateMin ?? 30,
    allDay: Boolean(input.allDay),
    status: 'open',
    createdAt: new Date().toISOString(),
    completedAt: null,
    dueDate: input.dueDate ?? null,
    seriesId: null,
    seriesDate: null,
    memberIds: input.memberIds ?? [],
    listId: input.listId ?? null,
  };
  set((s) => ({ ...s, tasks: [...s.tasks, task] }));
  return task;
}

export function updateTask(id: ID, patch: Partial<Task>) {
  set((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }));
}

export function toggleTask(id: ID) {
  set((s) => ({
    ...s,
    tasks: s.tasks.map((t) =>
      t.id === id
        ? t.status === 'done'
          ? { ...t, status: 'open', completedAt: null }
          : { ...t, status: 'done', completedAt: new Date().toISOString() }
        : t,
    ),
  }));
}

/** Löscht eine Aufgabe samt ihrer Zeitblöcke. Serientermine werden übersprungen statt neu erzeugt. */
export function deleteTask(id: ID) {
  set((s) => {
    const task = s.tasks.find((t) => t.id === id);
    const series =
      task?.seriesId && task.seriesDate
        ? s.series.map((ser) =>
            ser.id === task.seriesId && !ser.skipped.includes(task.seriesDate!)
              ? { ...ser, skipped: [...ser.skipped, task.seriesDate!] }
              : ser,
          )
        : s.series;
    return {
      ...s,
      series,
      tasks: s.tasks.filter((t) => t.id !== id),
      blocks: s.blocks.filter((b) => b.taskId !== id),
    };
  });
}

/* ------------------------------------------------------------------- Listen */

export function addTaskList(name: string): TaskList {
  const list: TaskList = {
    id: newId(),
    name: name.trim() || 'Neue Liste',
    order: state.taskLists.length,
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ ...s, taskLists: [...s.taskLists, list] }));
  return list;
}

export function updateTaskList(id: ID, patch: Partial<TaskList>) {
  set((s) => ({
    ...s,
    taskLists: s.taskLists.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  }));
}

/**
 * Löscht eine Liste. Ihre Aufgaben bleiben und rutschen zu "ohne Liste" –
 * eine Liste ist eine Ordnungshilfe, kein Behälter, dessen Verlust die
 * Arbeit mitnimmt.
 */
export function deleteTaskList(id: ID) {
  set((s) => ({
    ...s,
    taskLists: s.taskLists.filter((l) => l.id !== id),
    tasks: s.tasks.map((t) => (t.listId === id ? { ...t, listId: null } : t)),
  }));
}

/** Verschiebt eine Liste um eine Stelle nach oben oder unten. */
export function moveTaskList(id: ID, delta: number) {
  set((s) => {
    const sorted = [...s.taskLists].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((l) => l.id === id);
    const ziel = index + delta;
    if (index < 0 || ziel < 0 || ziel >= sorted.length) return s;
    const [bewegt] = sorted.splice(index, 1);
    sorted.splice(ziel, 0, bewegt);
    const neu = new Map(sorted.map((l, i) => [l.id, i]));
    return {
      ...s,
      taskLists: s.taskLists.map((l) => ({ ...l, order: neu.get(l.id) ?? l.order })),
    };
  });
}

/* -------------------------------------------------------------------- Blöcke */

/** Plant eine Aufgabe in den Tag ein. Ohne Startzeit wird die erste freie Lücke gesucht. */
export function scheduleTask(
  taskId: ID,
  date: string,
  startMin?: number,
  durationMin?: number,
): Block | null {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  /*
   * Eine ganztägige Aufgabe bekommt keine Uhrzeit gesucht. Wird sie aber
   * bewusst auf eine Stelle der Zeitachse gezogen (startMin gesetzt), ist
   * das die Ansage, sie doch zu terminieren.
   */
  const ganztags = Boolean(task.allDay) && startMin === undefined;

  const duration = ganztags
    ? 0
    : Math.max(state.settings.slotMin, durationMin ?? (task.estimateMin || 30));
  const dayBlocks = state.blocks.filter((b) => b.date === date);
  const start = ganztags ? 0 : (startMin ?? findFreeSlot(dayBlocks, duration, state.settings));
  const block: Block = {
    id: newId(),
    date,
    startMin: start,
    durationMin: duration,
    allDay: ganztags,
    taskId,
    title: '',
    contextId: task.contextId,
    // Bleibt leer: bei Aufgabenblöcken gilt die Zuordnung der Aufgabe.
    memberIds: [],
  };
  set((s) => ({ ...s, blocks: [...s.blocks, block] }));
  return block;
}

export function addFixedBlock(input: {
  date: string;
  startMin: number;
  durationMin: number;
  title: string;
  contextId: ID;
  allDay?: boolean;
  notes?: string;
  memberIds?: ID[];
}): Block {
  const block: Block = {
    id: newId(),
    date: input.date,
    startMin: input.startMin,
    durationMin: input.durationMin,
    allDay: Boolean(input.allDay),
    taskId: null,
    title: input.title.trim() || 'Termin',
    notes: input.notes ?? '',
    contextId: input.contextId,
    memberIds: input.memberIds ?? [],
  };
  set((s) => ({ ...s, blocks: [...s.blocks, block] }));
  return block;
}

export function updateBlock(id: ID, patch: Partial<Block>) {
  set((s) => ({
    ...s,
    blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
  }));
}

export function deleteBlock(id: ID) {
  set((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id) }));
}

/** Nimmt alle Blöcke einer Aufgabe aus dem Plan – die Aufgabe wandert zurück in den Pool. */
export function unscheduleTask(taskId: ID) {
  set((s) => ({ ...s, blocks: s.blocks.filter((b) => b.taskId !== taskId) }));
}

/* ------------------------------------------------------------------ Kontexte */

export function addContext(name: string, color: string): Context {
  const context: Context = { id: newId(), name: name.trim() || 'Neuer Bereich', color };
  set((s) => ({ ...s, contexts: [...s.contexts, context].sort(byName) }));
  return context;
}

export function updateContext(id: ID, patch: Partial<Context>) {
  set((s) => ({
    ...s,
    contexts: s.contexts.map((c) => (c.id === id ? { ...c, ...patch } : c)).sort(byName),
  }));
}

/** Löscht einen Bereich und schiebt alles Zugehörige in den ersten verbleibenden Bereich. */
export function deleteContext(id: ID) {
  set((s) => {
    if (s.contexts.length <= 1) return s;
    const fallback = s.contexts.find((c) => c.id !== id)!.id;
    return {
      ...s,
      contexts: s.contexts.filter((c) => c.id !== id),
      tasks: s.tasks.map((t) => (t.contextId === id ? { ...t, contextId: fallback } : t)),
      blocks: s.blocks.map((b) => (b.contextId === id ? { ...b, contextId: fallback } : b)),
      series: s.series.map((x) => (x.contextId === id ? { ...x, contextId: fallback } : x)),
    };
  });
}

/* --------------------------------------------------------------------- Serien */

export type NewSeriesInput = Omit<Series, 'id' | 'skipped' | 'active'> &
  Partial<Pick<Series, 'active'>>;

export function addSeries(input: NewSeriesInput): Series {
  const series: Series = { ...input, id: newId(), skipped: [], active: input.active ?? true };
  set((s) => ({ ...s, series: [...s.series, series] }));
  return series;
}

export function updateSeries(id: ID, patch: Partial<Series>) {
  set((s) => ({
    ...s,
    series: s.series.map((x) => (x.id === id ? { ...x, ...patch } : x)),
  }));
}

/** Löscht eine Serie. Bereits erzeugte, noch offene Aufgaben verschwinden mit. */
export function deleteSeries(id: ID) {
  set((s) => {
    const orphaned = new Set(
      s.tasks.filter((t) => t.seriesId === id && t.status === 'open').map((t) => t.id),
    );
    return {
      ...s,
      series: s.series.filter((x) => x.id !== id),
      tasks: s.tasks.filter((t) => !orphaned.has(t.id)),
      blocks: s.blocks.filter((b) => !b.taskId || !orphaned.has(b.taskId)),
    };
  });
}

/**
 * Erzeugt für die angegebenen Tage die noch fehlenden Serien-Aufgaben.
 * Idempotent: pro Serie und Tag entsteht höchstens eine Aufgabe.
 */
export function materializeSeries(dates: string[]) {
  if (!hydrated) return;
  const existing = new Set(
    state.tasks.filter((t) => t.seriesId).map((t) => `${t.seriesId}|${t.seriesDate}`),
  );
  const newTasks: Task[] = [];
  const newBlocks: Block[] = [];
  const now = new Date().toISOString();

  for (const series of state.series) {
    for (const date of dates) {
      if (existing.has(`${series.id}|${date}`)) continue;
      if (!seriesOccursOn(series, date)) continue;
      const task: Task = {
        id: newId(),
        title: series.title,
        notes: series.notes,
        contextId: series.contextId,
        estimateMin: series.estimateMin,
        allDay: Boolean(series.allDay),
        status: 'open',
        createdAt: now,
        completedAt: null,
        dueDate: date,
        seriesId: series.id,
        seriesDate: date,
        memberIds: series.memberIds ?? [],
      };
      newTasks.push(task);
      existing.add(`${series.id}|${date}`);

      // Eine ganztägige Serie wird immer gelegt – eine Uhrzeit hätte sie nicht,
      // auf die man warten müsste.
      if (series.autoScheduleMin !== null || series.allDay) {
        newBlocks.push({
          id: newId(),
          date,
          startMin: series.allDay ? 0 : series.autoScheduleMin!,
          durationMin: series.allDay ? 0 : series.estimateMin,
          allDay: Boolean(series.allDay),
          taskId: task.id,
          title: '',
          contextId: series.contextId,
          memberIds: [],
        });
      }
    }
  }

  if (!newTasks.length) return;
  set((s) => ({ ...s, tasks: [...s.tasks, ...newTasks], blocks: [...s.blocks, ...newBlocks] }));
}

/* ---------------------------------------------------------- Haushaltskasse */

export type NewExpenseInput = {
  date: string;
  title: string;
  cents: number;
  estimatedCents?: number | null;
  category?: string;
  memberIds?: ID[];
  note?: string;
};

export function addExpense(input: NewExpenseInput): Expense {
  const expense: Expense = {
    id: newId(),
    date: input.date,
    title: input.title.trim() || 'Ausgabe',
    cents: Math.max(0, Math.round(input.cents)),
    estimatedCents: input.estimatedCents ?? null,
    category: input.category?.trim() || 'Sonstiges',
    memberIds: input.memberIds ?? [],
    note: input.note ?? '',
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ ...s, expenses: [...s.expenses, expense] }));
  return expense;
}

export function updateExpense(id: ID, patch: Partial<Expense>) {
  set((s) => ({ ...s, expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
}

export function deleteExpense(id: ID) {
  set((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
}

/**
 * Bucht den Inhalt des Wagens als Ausgabe und räumt die Liste auf.
 *
 * Das Preisgedächtnis lernt dabei wie beim schlichten Aufräumen – aber aus
 * den geschätzten Einzelpreisen, nicht aus dem Rechnungsbetrag: der gilt für
 * den ganzen Einkauf und ließe sich keiner einzelnen Position zuordnen.
 */
export function bookDoneAsExpense(input: {
  date: string;
  title: string;
  cents: number;
  category?: string;
  memberIds?: ID[];
  note?: string;
}): Expense | null {
  const abgehakt = state.shopping.filter((item) => item.done);
  if (abgehakt.length === 0) return null;

  const geschaetzt = abgehakt.reduce((sum, item) => sum + (item.estimatedCents ?? 0), 0);
  const expense = addExpense({
    ...input,
    estimatedCents: geschaetzt > 0 ? geschaetzt : null,
  });
  clearDoneShoppingItems();
  return expense;
}

/* ------------------------------------------------------------ Feste Kosten */

export type NewRecurringInput = {
  title: string;
  cents: number;
  category?: string;
  memberIds?: ID[];
  interval?: RecurringInterval;
  startMonth: string;
  note?: string;
};

export function addRecurringExpense(input: NewRecurringInput): RecurringExpense {
  const rule: RecurringExpense = {
    id: newId(),
    title: input.title.trim() || 'Fester Posten',
    cents: Math.max(0, Math.round(input.cents)),
    category: input.category?.trim() || 'Wohnen',
    memberIds: input.memberIds ?? [],
    interval: input.interval ?? 'monatlich',
    startMonth: input.startMonth,
    endMonth: null,
    note: input.note ?? '',
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ ...s, recurringExpenses: [...s.recurringExpenses, rule] }));
  return rule;
}

export function updateRecurringExpense(id: ID, patch: Partial<RecurringExpense>) {
  set((s) => ({
    ...s,
    recurringExpenses: s.recurringExpenses.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  }));
}

/**
 * Betrag ändern heißt: den alten Posten beenden und einen neuen anlegen.
 *
 * Eine Mieterhöhung ab Juli soll den Juni nicht rückwirkend teurer machen.
 * Mit Start- und Endmonat bildet das die Wirklichkeit ab und kommt ohne
 * Sondermechanik für rückwirkende Änderungen aus.
 */
export function changeRecurringAmount(
  id: ID,
  cents: number,
  fromMonth: string,
): RecurringExpense | null {
  const alt = state.recurringExpenses.find((r) => r.id === id);
  if (!alt) return null;

  const vorMonat = shiftMonthKey(fromMonth, -1);
  // Ab dem Startmonat geändert: dann gibt es nichts zu bewahren.
  if (fromMonth <= alt.startMonth) {
    updateRecurringExpense(id, { cents: Math.max(0, Math.round(cents)) });
    return { ...alt, cents };
  }

  updateRecurringExpense(id, { endMonth: vorMonat });
  return addRecurringExpense({
    title: alt.title,
    cents,
    category: alt.category,
    memberIds: alt.memberIds,
    interval: alt.interval,
    startMonth: fromMonth,
    note: alt.note,
  });
}

/** Beendet einen Posten, ohne die Vergangenheit zu verändern. */
export function endRecurringExpense(id: ID, lastMonth: string) {
  updateRecurringExpense(id, { endMonth: lastMonth });
}

export function deleteRecurringExpense(id: ID) {
  set((s) => ({ ...s, recurringExpenses: s.recurringExpenses.filter((r) => r.id !== id) }));
}

/** Nur hier gebraucht – die Monatsrechnung liegt in domain/budget. */
function shiftMonthKey(key: string, delta: number): string {
  let jahr = Number(key.slice(0, 4));
  let monat = Number(key.slice(5, 7)) + delta;
  while (monat < 1) {
    monat += 12;
    jahr -= 1;
  }
  while (monat > 12) {
    monat -= 12;
    jahr += 1;
  }
  return `${jahr}-${String(monat).padStart(2, '0')}`;
}

/* ------------------------------------------------------------ Essensplanung */

export function addRecipe(title: string, servings = 2): Recipe {
  const recipe: Recipe = {
    id: newId(),
    title: title.trim() || 'Neues Gericht',
    servings: Math.max(1, servings),
    notes: '',
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ ...s, recipes: [...s.recipes, recipe] }));
  return recipe;
}

export function updateRecipe(id: ID, patch: Partial<Recipe>) {
  set((s) => ({ ...s, recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
}

/**
 * Löscht ein Gericht samt Zutaten. Geplante Mahlzeiten behalten ihren Platz
 * im Wochenplan und tragen den Titel als Freitext weiter – sonst entstünden
 * Lücken an Tagen, an denen sehr wohl etwas gekocht wurde.
 */
export function deleteRecipe(id: ID) {
  set((s) => {
    const recipe = s.recipes.find((r) => r.id === id);
    return {
      ...s,
      recipes: s.recipes.filter((r) => r.id !== id),
      recipeIngredients: s.recipeIngredients.filter((i) => i.recipeId !== id),
      meals: s.meals.map((m) =>
        m.recipeId === id ? { ...m, recipeId: null, title: m.title || (recipe?.title ?? '') } : m,
      ),
    };
  });
}

export function addIngredient(
  recipeId: ID,
  input: { name: string; quantity?: number | null; unit?: string; staple?: boolean },
): RecipeIngredient {
  const zutat: RecipeIngredient = {
    id: newId(),
    recipeId,
    name: input.name.trim(),
    quantity: input.quantity ?? null,
    unit: input.unit?.trim() ?? '',
    staple: input.staple ?? false,
  };
  set((s) => ({ ...s, recipeIngredients: [...s.recipeIngredients, zutat] }));
  return zutat;
}

export function updateIngredient(id: ID, patch: Partial<RecipeIngredient>) {
  set((s) => ({
    ...s,
    recipeIngredients: s.recipeIngredients.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  }));
}

export function deleteIngredient(id: ID) {
  set((s) => ({ ...s, recipeIngredients: s.recipeIngredients.filter((i) => i.id !== id) }));
}

/**
 * Setzt ein Gericht auf einen Tag. Pro Tag und Mahlzeit gibt es einen Platz;
 * ein zweiter Eintrag ersetzt den ersten, statt sich danebenzustellen.
 */
export function setMeal(
  date: string,
  slot: MealSlot,
  input: { recipeId?: ID | null; title?: string; servings?: number },
): MealEntry {
  const entry: MealEntry = {
    id: newId(),
    date,
    slot,
    recipeId: input.recipeId ?? null,
    title: input.title?.trim() ?? '',
    servings: Math.max(1, input.servings ?? 2),
    createdAt: new Date().toISOString(),
  };
  set((s) => ({
    ...s,
    meals: [...s.meals.filter((m) => !(m.date === date && m.slot === slot)), entry],
  }));
  return entry;
}

export function updateMeal(id: ID, patch: Partial<MealEntry>) {
  set((s) => ({ ...s, meals: s.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
}

export function clearMeal(date: string, slot: MealSlot) {
  set((s) => ({ ...s, meals: s.meals.filter((m) => !(m.date === date && m.slot === slot)) }));
}

/* ------------------------------------------------------------ Kalenderimport */

export type CalendarImport = {
  /** Termine mit Uhrzeit werden Blöcke. */
  events: Array<{
    uid: string;
    title: string;
    date: string;
    startMin: number | null;
    durationMin: number;
    location: string;
    description: string;
    allDay: boolean;
  }>;
  contextId: ID;
  memberIds: ID[];
};

export type ImportOutcome = { added: number; skipped: number };

/**
 * Übernimmt eingelesene Kalendertermine.
 *
 * Termine mit Uhrzeit werden Blöcke im Tagesplan. Ganztägige Einträge werden
 * Aufgaben mit Fälligkeit statt Blöcke über den ganzen Tag: ein Geburtstag
 * oder eine Messe soll den Tagesplan nicht als ausgebucht erscheinen lassen.
 *
 * Doppel werden über die Kennung aus der Datei erkannt. Wer denselben Kalender
 * ein zweites Mal einliest, bekommt nur das Neue dazu.
 */
export function importCalendar({ events, contextId, memberIds }: CalendarImport): ImportOutcome {
  const bekannt = new Set<string>();
  for (const b of state.blocks) if (b.icsUid) bekannt.add(b.icsUid);
  for (const t of state.tasks) if (t.icsUid) bekannt.add(t.icsUid);

  const neueBloecke: Block[] = [];
  // Ganztägige Termine wurden früher zu Aufgaben; seit es ganztägige Einträge
  // gibt, entstehen beim Einlesen nur noch Blöcke.
  const neueAufgaben: Task[] = [];
  let skipped = 0;

  for (const event of events) {
    if (bekannt.has(event.uid)) {
      skipped += 1;
      continue;
    }
    bekannt.add(event.uid);

    const notiz = [event.location, event.description].filter(Boolean).join('\n');

    /*
     * Ganztägige Termine wurden früher zu Aufgaben mit Fälligkeit – ein
     * Notbehelf, solange es nichts Ganztägiges gab. Jetzt landen sie dort,
     * wo sie hingehören: als ganztägiger Eintrag am jeweiligen Tag. Ein
     * mehrtägiger Termin bekommt für jeden Tag einen eigenen.
     */
    if (event.allDay || event.startMin === null) {
      const tage = Math.max(1, Math.ceil(event.durationMin / (24 * 60)));
      for (let i = 0; i < tage; i += 1) {
        neueBloecke.push({
          id: newId(),
          date: addDays(event.date, i),
          startMin: 0,
          durationMin: 0,
          allDay: true,
          taskId: null,
          title: event.title,
          notes: notiz,
          contextId,
          memberIds,
          // Nur der erste Tag trägt die Kennung, sonst gälte der Termin beim
          // erneuten Einlesen als teils bekannt und teils neu.
          ...(i === 0 ? { icsUid: event.uid } : {}),
        });
      }
      continue;
    }

    neueBloecke.push({
      id: newId(),
      date: event.date,
      startMin: event.startMin,
      // Ein Termin, der über Mitternacht reicht, wird am Starttag gekappt –
      // die Zeitachse kennt nur einen Tag.
      durationMin: Math.min(event.durationMin, 24 * 60 - event.startMin),
      taskId: null,
      title: event.title,
      notes: notiz,
      contextId,
      memberIds,
      icsUid: event.uid,
    });
  }

  if (neueBloecke.length || neueAufgaben.length) {
    set((s) => ({
      ...s,
      blocks: [...s.blocks, ...neueBloecke],
      tasks: [...s.tasks, ...neueAufgaben],
    }));
  }
  return { added: neueBloecke.length + neueAufgaben.length, skipped };
}

/** Entfernt alles, was aus einer Kalenderdatei stammt. */
export function removeImportedCalendar(): number {
  const bloecke = state.blocks.filter((b) => b.icsUid).length;
  const aufgaben = state.tasks.filter((t) => t.icsUid).length;
  if (bloecke + aufgaben === 0) return 0;
  set((s) => ({
    ...s,
    blocks: s.blocks.filter((b) => !b.icsUid),
    tasks: s.tasks.filter((t) => !t.icsUid),
  }));
  return bloecke + aufgaben;
}

/* ------------------------------------------------------------- Einkaufsliste */

export type NewShoppingInput = {
  name: string;
  quantity?: number | null;
  unit?: string;
  estimatedCents?: number | null;
  note?: string;
  createdBy?: string | null;
};

export function addShoppingItem(input: NewShoppingInput): ShoppingItem {
  const item: ShoppingItem = {
    id: newId(),
    name: input.name.trim(),
    quantity: input.quantity ?? null,
    unit: input.unit ?? '',
    estimatedCents: input.estimatedCents ?? null,
    done: false,
    note: input.note ?? '',
    createdAt: new Date().toISOString(),
    doneAt: null,
    createdBy: input.createdBy ?? null,
  };
  set((s) => ({
    ...s,
    shopping: [...s.shopping, item],
    settings:
      item.estimatedCents !== null
        ? {
            ...s.settings,
            priceMemory: rememberPrice(s.settings.priceMemory, item.name, item.estimatedCents),
          }
        : s.settings,
  }));
  return item;
}

export function addShoppingItems(inputs: NewShoppingInput[]): ShoppingItem[] {
  return inputs.map(addShoppingItem);
}

export function updateShoppingItem(id: ID, patch: Partial<ShoppingItem>) {
  set((s) => {
    const shopping = s.shopping.map((item) => (item.id === id ? { ...item, ...patch } : item));
    const changed = shopping.find((item) => item.id === id);
    const learned =
      changed && changed.estimatedCents !== null
        ? rememberPrice(s.settings.priceMemory, changed.name, changed.estimatedCents)
        : s.settings.priceMemory;
    return {
      ...s,
      shopping,
      settings:
        learned === s.settings.priceMemory ? s.settings : { ...s.settings, priceMemory: learned },
    };
  });
}

export function toggleShoppingItem(id: ID) {
  set((s) => ({
    ...s,
    shopping: s.shopping.map((item) =>
      item.id === id
        ? item.done
          ? { ...item, done: false, doneAt: null }
          : { ...item, done: true, doneAt: new Date().toISOString() }
        : item,
    ),
  }));
}

export function deleteShoppingItem(id: ID) {
  set((s) => ({ ...s, shopping: s.shopping.filter((item) => item.id !== id) }));
}

/**
 * Räumt nach dem Einkauf auf. Die Preise wandern vorher ins Gedächtnis –
 * sonst wäre mit dem Aufräumen auch das Wissen weg, was ein Artikel kostet.
 */
export function clearDoneShoppingItems() {
  set((s) => {
    let memory = s.settings.priceMemory;
    for (const item of s.shopping) {
      if (item.done && item.estimatedCents !== null) {
        memory = rememberPrice(memory, item.name, item.estimatedCents, item.doneAt ?? undefined);
      }
    }
    return {
      ...s,
      shopping: s.shopping.filter((item) => !item.done),
      settings:
        memory === s.settings.priceMemory ? s.settings : { ...s.settings, priceMemory: memory },
    };
  });
}

/** Summe der geschätzten Kosten; `onlyOpen` blendet bereits Eingekauftes aus. */
export function shoppingTotalCents(items: ShoppingItem[], onlyOpen = false): number {
  return items
    .filter((item) => (onlyOpen ? !item.done : true))
    .reduce((sum, item) => sum + (item.estimatedCents ?? 0), 0);
}

/** Wie viele Positionen haben gar keine Preisschätzung? */
export function shoppingUnpricedCount(items: ShoppingItem[], onlyOpen = false): number {
  return items.filter((item) => (onlyOpen ? !item.done : true) && item.estimatedCents === null)
    .length;
}

/* ------------------------------------------------------------- Sonstiges */

export function updateSettings(patch: Partial<Settings>) {
  set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

/** Schiebt offene, nicht erledigte Aufgaben eines Tages auf einen anderen Tag. */
export function rolloverOpenTasks(fromDate: string, toDate: string) {
  set((s) => {
    const openOnDay = s.blocks
      .filter((b) => b.date === fromDate && b.taskId)
      .map((b) => b.taskId!)
      .filter((id) => s.tasks.find((t) => t.id === id)?.status === 'open');
    const moving = new Set(openOnDay);
    const targetBlocks = s.blocks.filter((b) => b.date === toDate);
    const rescheduled: Block[] = [];
    const kept = s.blocks.filter((b) => !(b.date === fromDate && b.taskId && moving.has(b.taskId)));

    for (const taskId of moving) {
      const original = s.blocks.find((b) => b.date === fromDate && b.taskId === taskId)!;
      const start = findFreeSlot(
        [...targetBlocks, ...rescheduled],
        original.durationMin,
        s.settings,
        original.startMin,
      );
      rescheduled.push({ ...original, id: newId(), date: toDate, startMin: start });
    }
    return { ...s, blocks: [...kept, ...rescheduled] };
  });
}

export function replaceState(next: AppState) {
  set(() => ({ ...initialState(), ...next, version: STATE_VERSION }));
}

export function resetState() {
  set(() => initialState());
}

/* ------------------------------------------------------------- Selektoren */

export function tasksForDay(s: AppState, date: string): Task[] {
  const ids = new Set(s.blocks.filter((b) => b.date === date && b.taskId).map((b) => b.taskId!));
  return s.tasks.filter((t) => ids.has(t.id));
}

export function blocksForDay(s: AppState, date: string): Block[] {
  return s.blocks.filter((b) => b.date === date).sort((a, b) => a.startMin - b.startMin);
}

/** Aufgaben ohne Zeitblock – der Pool auf der linken Seite. */
export function backlogTasks(s: AppState): Task[] {
  const scheduled = new Set(s.blocks.filter((b) => b.taskId).map((b) => b.taskId!));
  return s.tasks.filter((t) => t.status === 'open' && !scheduled.has(t.id));
}

export function taskById(s: AppState, id: ID | null): Task | undefined {
  return id ? s.tasks.find((t) => t.id === id) : undefined;
}

export function contextById(s: AppState, id: ID): Context {
  return s.contexts.find((c) => c.id === id) ?? s.contexts[0];
}

/** Tage, an denen ein Block über das Tagesfenster hinausragt – für Hinweise. */
export function overflowingBlocks(s: AppState, date: string): Block[] {
  return s.blocks.filter((b) => b.date === date && blockEnd(b) > s.settings.dayEndMin);
}

export const todayISO = today;

/* ------------------------------------------------------ Urlaub und Reisen */

export function addMember(name: string, color: string, annualLeaveDays = 30): Member {
  const member: Member = { id: newId(), name: name.trim() || 'Person', color, annualLeaveDays };
  set((s) => ({ ...s, members: [...s.members, member] }));
  return member;
}

export function updateMember(id: ID, patch: Partial<Member>) {
  set((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
}

/** Löscht eine Person samt ihrer Abwesenheiten und Jahresangaben. */
export function deleteMember(id: ID) {
  set((s) => {
    // Aufgaben und Termine der Person bleiben bestehen – sie sind Arbeit, die
    // weiter ansteht. Nur die Zuordnung fällt weg, sie gelten dann als offen.
    const ohne = <T extends { memberIds: ID[] }>(list: T[]) =>
      list.map((e) =>
        e.memberIds.includes(id) ? { ...e, memberIds: e.memberIds.filter((m) => m !== id) } : e,
      );
    return {
      ...s,
      members: s.members.filter((m) => m.id !== id),
      absences: s.absences.filter((a) => a.memberId !== id),
      leaveYears: s.leaveYears.filter((y) => y.memberId !== id),
      tasks: ohne(s.tasks),
      blocks: ohne(s.blocks),
      series: ohne(s.series),
    };
  });
}

export type NewAbsenceInput = {
  memberId: ID;
  kind: AbsenceKind;
  startDate: string;
  endDate: string;
  note?: string;
  tripId?: ID | null;
};

export function addAbsence(input: NewAbsenceInput): Absence {
  // Verdrehte Eingaben still geraderücken statt einen Zeitraum ohne Tage anzulegen.
  const [startDate, endDate] =
    input.endDate < input.startDate
      ? [input.endDate, input.startDate]
      : [input.startDate, input.endDate];

  const absence: Absence = {
    id: newId(),
    memberId: input.memberId,
    kind: input.kind,
    startDate,
    endDate,
    note: input.note ?? '',
    tripId: input.tripId ?? null,
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ ...s, absences: [...s.absences, absence] }));
  return absence;
}

export function updateAbsence(id: ID, patch: Partial<Absence>) {
  set((s) => ({
    ...s,
    absences: s.absences.map((a) => {
      if (a.id !== id) return a;
      const next = { ...a, ...patch };
      return next.endDate < next.startDate
        ? { ...next, startDate: next.endDate, endDate: next.startDate }
        : next;
    }),
  }));
}

export function deleteAbsence(id: ID) {
  set((s) => ({ ...s, absences: s.absences.filter((a) => a.id !== id) }));
}

/** Legt die Jahresangabe an oder ändert sie; die Kennung bleibt stabil. */
export function setLeaveYear(memberId: ID, year: number, patch: Partial<LeaveYear>) {
  set((s) => {
    const id = `${memberId}-${year}`;
    const existing = s.leaveYears.find((y) => y.id === id);
    const member = s.members.find((m) => m.id === memberId);
    const base: LeaveYear = existing ?? {
      id,
      memberId,
      year,
      entitlementDays: member?.annualLeaveDays ?? 30,
      carryOverDays: 0,
    };
    const next = { ...base, ...patch, id, memberId, year };
    return {
      ...s,
      leaveYears: existing
        ? s.leaveYears.map((y) => (y.id === id ? next : y))
        : [...s.leaveYears, next],
    };
  });
}

/* ------------------------------------------- Geburtstage und Jahrestage */

export function addAnniversary(input: Omit<Anniversary, 'id' | 'createdAt'>): Anniversary {
  const anniversary: Anniversary = {
    ...input,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ ...s, anniversaries: [...s.anniversaries, anniversary] }));
  return anniversary;
}

export function updateAnniversary(id: ID, patch: Partial<Anniversary>) {
  set((s) => ({
    ...s,
    anniversaries: s.anniversaries.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  }));
}

export function deleteAnniversary(id: ID) {
  set((s) => ({ ...s, anniversaries: s.anniversaries.filter((a) => a.id !== id) }));
}

export function addTrip(input: Omit<Trip, 'id' | 'createdAt'>): Trip {
  const trip: Trip = { ...input, id: newId(), createdAt: new Date().toISOString() };
  set((s) => ({ ...s, trips: [...s.trips, trip] }));
  return trip;
}

export function updateTrip(id: ID, patch: Partial<Trip>) {
  set((s) => ({ ...s, trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
}

/** Löscht eine Reise samt ihrer Punkte; verknüpfte Abwesenheiten bleiben bestehen. */
export function deleteTrip(id: ID) {
  set((s) => ({
    ...s,
    trips: s.trips.filter((t) => t.id !== id),
    tripItems: s.tripItems.filter((i) => i.tripId !== id),
    absences: s.absences.map((a) => (a.tripId === id ? { ...a, tripId: null } : a)),
  }));
}

export function addTripItem(input: {
  tripId: ID;
  kind: TripItemKind;
  title: string;
  estimatedCents?: number | null;
  date?: string | null;
  note?: string;
}): TripItem {
  const item: TripItem = {
    id: newId(),
    tripId: input.tripId,
    kind: input.kind,
    title: input.title.trim(),
    done: false,
    estimatedCents: input.estimatedCents ?? null,
    date: input.date ?? null,
    note: input.note ?? '',
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ ...s, tripItems: [...s.tripItems, item] }));
  return item;
}

export function updateTripItem(id: ID, patch: Partial<TripItem>) {
  set((s) => ({ ...s, tripItems: s.tripItems.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
}

export function toggleTripItem(id: ID) {
  set((s) => ({
    ...s,
    tripItems: s.tripItems.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
  }));
}

export function deleteTripItem(id: ID) {
  set((s) => ({ ...s, tripItems: s.tripItems.filter((i) => i.id !== id) }));
}
