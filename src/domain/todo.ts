import type { AppState, ID, Task, TaskList } from './types';

/**
 * Die Aufgabenliste – dieselben Aufgaben wie im Pool, nur ohne Zeitachse
 * daneben.
 *
 * Bewusst keine zweite Sammlung: Es soll genau einen Ort geben, an dem eine
 * Aufgabe steht. Wer eine Erledigung doch einplanen will, zieht sie von hier
 * in den Tag, ohne sie neu einzutippen.
 */

/** Ohne Liste einsortierte Aufgaben stehen unter diesem Schlüssel. */
export const NO_LIST = '__ohne__';

export type TodoGroup = {
  /** Die Liste, oder null für "ohne Liste". */
  list: TaskList | null;
  open: Task[];
  done: Task[];
};

/** Ist die Aufgabe für einen Tag eingeplant? */
export function isScheduled(taskId: ID, state: AppState): boolean {
  return state.blocks.some((b) => b.taskId === taskId);
}

/**
 * Sortiert offene Aufgaben: Fälliges zuerst, danach das Ältere.
 *
 * Undatiertes ans Ende – nicht weil es unwichtig wäre, sondern weil ein Datum
 * eine Aussage über Dringlichkeit ist und das Fehlen keine.
 */
export function byUrgency(a: Task, b: Task): number {
  const da = a.dueDate ?? '9999-12-31';
  const db = b.dueDate ?? '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : 1;
}

/** Erledigtes zuletzt abgehakt zuerst – das ist die Reihenfolge, die zählt. */
export function byCompletion(a: Task, b: Task): number {
  const ca = a.completedAt ?? '';
  const cb = b.completedAt ?? '';
  return ca > cb ? -1 : ca < cb ? 1 : 0;
}

export type GroupOptions = {
  tasks: Task[];
  lists: TaskList[];
  /** Nur diese Bereiche zeigen. */
  activeContexts: Set<ID>;
  /** Nur diese Listen zeigen; leer heißt "alle". */
  activeLists: Set<ID>;
  /** Erledigtes mitzeigen? */
  showDone: boolean;
};

/**
 * Gruppiert Aufgaben nach Liste.
 *
 * Leere Listen bleiben sichtbar: Eine Liste, die man angelegt hat, soll nicht
 * verschwinden, sobald man sie abgearbeitet hat – sonst wüsste man nicht mehr,
 * wohin das Nächste gehört.
 */
export function groupByList({
  tasks,
  lists,
  activeContexts,
  activeLists,
  showDone,
}: GroupOptions): TodoGroup[] {
  const sichtbar = tasks.filter((t) => {
    if (!activeContexts.has(t.contextId)) return false;
    if (activeLists.size > 0) {
      const key = t.listId ?? NO_LIST;
      if (!activeLists.has(key)) return false;
    }
    return showDone || t.status === 'open';
  });

  const geordnet = [...lists].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'de'),
  );
  const gruppen: TodoGroup[] = geordnet.map((list) => ({ list, open: [], done: [] }));
  const ohne: TodoGroup = { list: null, open: [], done: [] };

  for (const task of sichtbar) {
    const ziel = (task.listId && gruppen.find((g) => g.list?.id === task.listId)) || ohne;
    if (task.status === 'done') ziel.done.push(task);
    else ziel.open.push(task);
  }

  for (const gruppe of [...gruppen, ohne]) {
    gruppe.open.sort(byUrgency);
    gruppe.done.sort(byCompletion);
  }

  /*
   * "Ohne Liste" steht oben, wenn dort etwas liegt: Frisch Eingetipptes
   * landet dort und soll nicht unter allen Listen versteckt sein.
   */
  const hatOhne = ohne.open.length > 0 || ohne.done.length > 0;
  return hatOhne ? [ohne, ...gruppen] : gruppen;
}

/** Wie viele offene Aufgaben eine Liste hat – für die Zähler an den Filtern. */
export function openCountByList(tasks: Task[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const task of tasks) {
    if (task.status !== 'open') continue;
    const key = task.listId ?? NO_LIST;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

/** Überfällig heißt: Fälligkeit liegt vor heute und nichts ist abgehakt. */
export function isOverdue(task: Task, today: string): boolean {
  return task.status === 'open' && task.dueDate !== null && task.dueDate < today;
}

/** Was heute oder früher fällig ist – die Kurzfassung ganz oben. */
export function dueToday(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((t) => t.status === 'open' && t.dueDate !== null && t.dueDate <= today)
    .sort(byUrgency);
}
