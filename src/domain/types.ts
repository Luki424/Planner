export type ID = string;

/** Ein Lebensbereich, z.B. "Beruflich" oder "Privat". */
export type Context = {
  id: ID;
  name: string;
  /** Basisfarbe als CSS-Farbwert, wird für Kanten und Badges genutzt. */
  color: string;
};

/**
 * Eine Liste zum Sortieren von Aufgaben: "Haus", "Garten", "Umzug".
 *
 * Zweite Achse neben den Bereichen: Der Bereich sagt, ob etwas beruflich
 * oder privat ist; die Liste sagt, worum es geht. Beides zugleich zu
 * verlangen wäre lästig, deshalb ist die Liste freiwillig.
 */
export type TaskList = {
  id: ID;
  name: string;
  /** Reihenfolge in der Übersicht; kleinere Zahl steht weiter oben. */
  order: number;
  createdAt: string;
};

export type TaskStatus = 'open' | 'done';

export type Task = {
  id: ID;
  title: string;
  notes: string;
  contextId: ID;
  /** Geschätzte Dauer in Minuten. */
  estimateMin: number;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  /** Fälligkeit als YYYY-MM-DD, optional. */
  dueDate: string | null;
  /** Gesetzt, wenn die Aufgabe aus einer Serie stammt. */
  seriesId: ID | null;
  /** Der Tag, für den die Serie diese Aufgabe erzeugt hat. */
  seriesDate: string | null;
  /**
   * Wer zuständig ist. Leer heißt bewusst "noch offen" und nicht "niemand":
   * eine Aufgabe ohne Zuordnung bleibt für alle sichtbar, damit nichts
   * dadurch verschwindet, dass niemand sie an sich genommen hat.
   */
  memberIds: ID[];
  /** Kennung aus einer eingelesenen Kalenderdatei; siehe Block. */
  icsUid?: string;
  /** Zugehörige Liste; null heißt "ohne Liste". */
  listId?: ID | null;
};

/**
 * Ein Zeitblock im Tagesplan. Verweist entweder auf eine Aufgabe
 * (taskId gesetzt) oder ist ein fixer Termin ohne Aufgabe.
 * Eine Aufgabe darf mehrere Blöcke haben – so lässt sich eine große
 * Aufgabe über den Tag verteilen.
 */
export type Block = {
  id: ID;
  /** YYYY-MM-DD */
  date: string;
  /** Startzeit in Minuten seit Mitternacht. */
  startMin: number;
  durationMin: number;
  taskId: ID | null;
  /** Nur relevant, wenn taskId null ist (fixer Termin). */
  title: string;
  contextId: ID;
  /**
   * Wer den Termin hat. Nur bei fixen Terminen gepflegt – hängt ein Block an
   * einer Aufgabe, gilt deren Zuordnung, sonst müsste man sie doppelt pflegen
   * und könnte sie auseinanderlaufen lassen.
   */
  memberIds: ID[];
  /**
   * Kennung aus einer eingelesenen Kalenderdatei. Verhindert Doppel, wenn
   * derselbe Kalender ein zweites Mal eingelesen wird.
   */
  icsUid?: string;
};

export type RecurrencePattern =
  | { type: 'daily'; interval: number }
  /** weekdays: 0 = Montag … 6 = Sonntag */
  | { type: 'weekly'; interval: number; weekdays: number[] }
  | { type: 'monthly'; day: number };

/** Eine wiederkehrende Aufgabe. Erzeugt bei Bedarf konkrete Tasks. */
export type Series = {
  id: ID;
  title: string;
  notes: string;
  contextId: ID;
  estimateMin: number;
  pattern: RecurrencePattern;
  startDate: string;
  endDate: string | null;
  /** Wenn gesetzt, wird die Aufgabe direkt zu dieser Uhrzeit eingeplant. */
  autoScheduleMin: number | null;
  active: boolean;
  /** Tage (YYYY-MM-DD), an denen die Serie bewusst übersprungen wurde. */
  skipped: string[];
  /** Wer zuständig ist; wird auf jede erzeugte Aufgabe übertragen. */
  memberIds: ID[];
};

/**
 * Ein Eintrag auf der Einkaufsliste.
 * Preise liegen als ganze Cent vor – Fließkomma-Cent summieren sich sonst
 * sichtbar falsch auf.
 */
export type ShoppingItem = {
  id: ID;
  name: string;
  /** null, wenn keine Menge genannt wurde ("Brot" statt "2 Brote"). */
  quantity: number | null;
  /** Freitext wie "kg", "l", "Packung"; leer, wenn nur gezählt wird. */
  unit: string;
  /** Geschätzter Preis für die gesamte Position, in Cent. */
  estimatedCents: number | null;
  done: boolean;
  note: string;
  createdAt: string;
  doneAt: string | null;
  /** Anzeigename der Person, die den Eintrag erfasst hat – nur bei geteilter Liste. */
  createdBy: string | null;
};

/**
 * Zuletzt für einen Artikel bezahlter Preis.
 * `name` hält die Schreibweise fest, wie sie eingegeben wurde – der Schlüssel
 * im Gedächtnis ist vereinheitlicht und sähe als Vorschlag falsch aus.
 */
export type PriceMemoryEntry = { cents: number; at: string; name: string };

export type Settings = {
  /** Anfang der sichtbaren Zeitachse, Minuten seit Mitternacht. */
  dayStartMin: number;
  dayEndMin: number;
  /** Raster für Drag & Drop, in Minuten. */
  slotMin: number;
  /** Als "verplanbar" geltende Stunden pro Tag – Basis für die Auslastung. */
  capacityMin: number;
  /**
   * Preisgedächtnis der Einkaufsliste, nach vereinheitlichtem Namen.
   * Liegt bewusst in den Einstellungen: so wissen beide Haushaltsmitglieder,
   * was ein Artikel zuletzt gekostet hat, ohne dass daraus eine eigene
   * Sammlung mit eigenem Abgleich werden muss.
   */
  priceMemory: Record<string, PriceMemoryEntry>;
  /**
   * Persönliches Foto als Data-URL, gezeigt beim Start und in den
   * Einstellungen. Liegt bei den Einstellungen und wird damit im Haushalt
   * geteilt – absichtlich nicht im Programmcode, denn das Repository ist
   * öffentlich, die Ablage des Haushalts dagegen nicht.
   */
  personalPhoto: string | null;
  /** Beschriftung unter dem Foto, etwa "Lukas & Svenja". */
  personalCaption: string;
  /** Bundesland für die Feiertagsberechnung der Urlaubstage. */
  bundesland: string;
};

/* ------------------------------------------------------ Urlaub und Reisen */

/**
 * Eine Person, für die Urlaub geführt wird.
 * Bewusst unabhängig von der Anmeldung: der Planer soll auch ohne
 * eingerichtete Synchronisation für zwei Personen führen können.
 */
export type Member = {
  id: ID;
  name: string;
  color: string;
  /** Jahresanspruch in Urlaubstagen. */
  annualLeaveDays: number;
};

/** Krankheit und Gleitzeit verbrauchen keinen Urlaubsanspruch. */
export type AbsenceKind = 'urlaub' | 'gleitzeit' | 'krank' | 'sonstiges';

export type Absence = {
  id: ID;
  memberId: ID;
  kind: AbsenceKind;
  /** YYYY-MM-DD, beide Grenzen eingeschlossen. */
  startDate: string;
  endDate: string;
  note: string;
  /** Verknüpfte Reise, falls der Urlaub einer ist. */
  tripId: ID | null;
  createdAt: string;
};

/**
 * Abweichender Anspruch für ein einzelnes Jahr – etwa nach einem Wechsel der
 * Arbeitszeit oder mit Resturlaub aus dem Vorjahr. Existiert nur, wenn
 * tatsächlich etwas abweicht.
 */
export type LeaveYear = {
  id: ID;
  memberId: ID;
  year: number;
  entitlementDays: number;
  carryOverDays: number;
};

export type Trip = {
  id: ID;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
};

/**
 * Ein Punkt zu einer Reise. Packliste, Programm und Budget teilen sich eine
 * Sammlung – es sind dieselben Einträge mit unterschiedlichem Zweck.
 */
export type TripItemKind = 'packliste' | 'programm' | 'budget';

export type TripItem = {
  id: ID;
  tripId: ID;
  kind: TripItemKind;
  title: string;
  done: boolean;
  /** Nur bei Budgetposten. */
  estimatedCents: number | null;
  /** Nur bei Programmpunkten. */
  date: string | null;
  note: string;
  createdAt: string;
};

/* ------------------------------------------------------ Essen und Rezepte */

/**
 * Ein Gericht mit seinen Zutaten. `servings` sagt, für wie viele Personen die
 * Mengen gelten – daraus wird beim Einplanen hochgerechnet.
 */
export type Recipe = {
  id: ID;
  title: string;
  servings: number;
  notes: string;
  createdAt: string;
};

export type RecipeIngredient = {
  id: ID;
  recipeId: ID;
  name: string;
  /** null, wenn keine Menge sinnvoll ist ("etwas Petersilie"). */
  quantity: number | null;
  unit: string;
  /**
   * Vorrat: Salz, Öl, Mehl. Steht in der Zutatenliste, wandert aber nicht
   * ungefragt auf die Einkaufsliste – sonst stünde bei jedem Gericht Salz
   * darauf.
   */
  staple: boolean;
};

export type MealSlot = 'mittag' | 'abend';

/**
 * Ein Gericht an einem Tag. Ohne Rezept dahinter zählt der Freitext –
 * "Reste", "Essen gehen" und "bei Mama" gehören genauso in den Plan.
 */
export type MealEntry = {
  id: ID;
  /** YYYY-MM-DD */
  date: string;
  slot: MealSlot;
  recipeId: ID | null;
  title: string;
  servings: number;
  createdAt: string;
};

/* ---------------------------------------------------------- Haushaltskasse */

/**
 * Eine Ausgabe. `cents` ist, was tatsächlich bezahlt wurde; `estimatedCents`
 * hält fest, womit gerechnet worden war – erst der Vergleich sagt, ob die
 * Schätzungen auf der Einkaufsliste taugen.
 */
export type Expense = {
  id: ID;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  cents: number;
  estimatedCents: number | null;
  /** Freitext mit Vorschlägen – jeder Haushalt teilt anders ein. */
  category: string;
  /** Wer bezahlt hat; leer heißt "gemeinsam". */
  memberIds: ID[];
  note: string;
  createdAt: string;
};

/** Wie oft ein fester Posten anfällt. */
export type RecurringInterval = 'monatlich' | 'vierteljaehrlich' | 'jaehrlich';

/**
 * Ein fester Posten: Miete, Strom, Versicherung, Abo.
 *
 * Wird nicht als einzelne Ausgabe abgelegt, sondern für jeden Monat aus der
 * Regel gerechnet. So kann kein Monat fehlen, nur weil ihn niemand geöffnet
 * hat – und es entstehen keine Karteileichen für Jahre in der Zukunft.
 *
 * Ändert sich der Betrag, wird der alte Posten beendet und ein neuer angelegt.
 * Das bildet die Wirklichkeit ab und braucht keine Sondermechanik für
 * rückwirkende Änderungen.
 */
export type RecurringExpense = {
  id: ID;
  title: string;
  cents: number;
  category: string;
  memberIds: ID[];
  interval: RecurringInterval;
  /** Erster Monat, in dem er anfällt (YYYY-MM). */
  startMonth: string;
  /** Letzter Monat, ab dann gekündigt; null heißt "läuft weiter". */
  endMonth: string | null;
  note: string;
  createdAt: string;
};

/** Obergrenze für das Preisgedächtnis, damit das Dokument nicht unbegrenzt wächst. */
export const PRICE_MEMORY_LIMIT = 300;

export type AppState = {
  version: number;
  contexts: Context[];
  taskLists: TaskList[];
  tasks: Task[];
  blocks: Block[];
  series: Series[];
  shopping: ShoppingItem[];
  members: Member[];
  absences: Absence[];
  leaveYears: LeaveYear[];
  trips: Trip[];
  tripItems: TripItem[];
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  meals: MealEntry[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  settings: Settings;
};

/** Die Sammlungen, die einzeln synchronisiert werden. */
export const SYNCED_COLLECTIONS = [
  'contexts',
  'taskLists',
  'tasks',
  'blocks',
  'series',
  'shopping',
  'members',
  'absences',
  'leaveYears',
  'trips',
  'tripItems',
  'recipes',
  'recipeIngredients',
  'meals',
  'expenses',
  'recurringExpenses',
] as const;

export type SyncedCollection = (typeof SYNCED_COLLECTIONS)[number];

/** Alles, was synchronisiert wird, hat eine id – mehr braucht die Sync-Schicht nicht. */
export type Entity = { id: ID };
