/*
 * Was die Prüfungen gemeinsam brauchen: Playwright finden und einen Planer
 * mit vollen, realistischen Daten – lange Titel, gleichzeitige Termine,
 * Ganztägiges, Mengen mit Komma, feste Kosten, eine Bucketlist.
 *
 * Leere Ansichten zeigen keine Darstellungsfehler. Die meisten, die der
 * Rundgang gefunden hat, sah man erst mit einem Titel wie „Angebot für die
 * Ladetechnik der Wohnmobilsparte überarbeiten und abstimmen".
 */
import { createRequire } from 'node:module';

export async function ladePlaywright() {
  const require = createRequire(import.meta.url);
  for (const k of [
    process.env.PLAYWRIGHT_PACKAGE,
    'playwright',
    '/usr/local/lib/node_modules_global/playwright',
    '/opt/node-tools/node_modules/playwright',
  ].filter(Boolean)) {
    try {
      return require(k);
    } catch {
      // nächsten versuchen
    }
  }
  throw new Error('Playwright nicht gefunden. Setze PLAYWRIGHT_PACKAGE.');
}

export const ZIEL = process.env.PLANER_URL ?? 'http://localhost:5178/';
export const BROWSER =
  process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Legt den Zustand vor dem ersten Laden als Notspur ab – die gewinnt beim Start. */
export async function mitDaten(context, zustandObj) {
  await context.addInitScript((s) => {
    try {
      if (!sessionStorage.getItem('pruefung-gesetzt')) {
        localStorage.setItem('planner:mirror', JSON.stringify(s));
        sessionStorage.setItem('pruefung-gesetzt', '1');
      }
    } catch {
      // egal
    }
  }, zustandObj);
}

const iso = (d) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const jetzt = new Date().toISOString();
const heute = iso(0);
const jahr = new Date().getFullYear();

export function zustand() {
  const c1 = 'ctx-beruf';
  const c2 = 'ctx-privat';
  const m1 = 'mem-lukas';
  const m2 = 'mem-svenja';
  const aufgabe = (id, title, extra = {}) => ({
    id,
    title,
    notes: '',
    contextId: c1,
    estimateMin: 30,
    status: 'open',
    createdAt: jetzt,
    completedAt: null,
    dueDate: null,
    seriesId: null,
    seriesDate: null,
    memberIds: [],
    ...extra,
  });
  const block = (id, date, start, dauer, title, extra = {}) => ({
    id,
    date,
    startMin: start,
    durationMin: dauer,
    taskId: null,
    title,
    notes: '',
    contextId: c1,
    memberIds: [],
    ...extra,
  });
  const einkauf = (id, name, extra = {}) => ({
    id,
    name,
    quantity: null,
    unit: '',
    estimatedCents: null,
    done: false,
    note: '',
    createdAt: jetzt,
    doneAt: null,
    createdBy: null,
    ...extra,
  });
  return {
    version: 1,
    contexts: [
      { id: c1, name: 'Beruflich', color: '#3b82f6' },
      { id: c2, name: 'Privat', color: '#10b981' },
    ],
    taskLists: [],
    tasks: [
      aufgabe('t1', 'Angebot für die Ladetechnik der Wohnmobilsparte überarbeiten und abstimmen', {
        estimateMin: 90,
        dueDate: iso(2),
        memberIds: [m1],
      }),
      aufgabe('t2', 'Steuererklärung', { contextId: c2, dueDate: iso(-1) }),
      aufgabe('t3', 'Geschenk für Mama', { contextId: c2, allDay: true, estimateMin: 0 }),
      aufgabe('t4', 'Reifenwechsel Termin machen', { contextId: c2, memberIds: [m1, m2] }),
      aufgabe('t5', 'Erledigt: Kita-Anmeldung', {
        contextId: c2,
        status: 'done',
        completedAt: jetzt,
      }),
    ],
    blocks: [
      block('b1', heute, 9 * 60, 180, 'Oberderdingen Christoph Wacker', { memberIds: [m1] }),
      block('b2', heute, 11 * 60, 60, 'Monday-Kick-Off', {
        notes: 'Microsoft Teams-Besprechung',
      }),
      block('b3', heute, 11 * 60 + 15, 30, 'Rückruf Hartmann Stallbauprofis wegen der Absprache', {
        contextId: c2,
      }),
      block(
        'b4',
        heute,
        14 * 60,
        270,
        'CHARGE | RSM2 Workshop "Batterierecycling: Sammelinfrastruktur, Logistik und Lagerung"',
      ),
      block('b5', heute, 0, 0, 'Bereitschaft', { allDay: true }),
      block('b6', iso(1), 8 * 60, 60, 'Präsi Carthago'),
      block('b7', iso(2), 10 * 60, 60, 'Meeting TBB-BVD, charging equipment for RV'),
      block('b8', iso(3), 19 * 60, 120, 'Abendessen mit Freunden', {
        contextId: c2,
        memberIds: [m1, m2],
      }),
      block('b9', iso(9), 9 * 60, 60, 'Zahnarzt'),
      block('b10', iso(-3), 9 * 60, 60, 'Vergangener Termin'),
    ],
    series: [
      {
        id: 's1',
        title: 'Müll rausbringen',
        notes: '',
        contextId: c2,
        estimateMin: 10,
        pattern: { type: 'weekly', interval: 1, weekdays: [1] },
        startDate: iso(-20),
        endDate: null,
        autoScheduleMin: null,
        active: true,
        skipped: [],
        memberIds: [m2],
      },
    ],
    shopping: [
      einkauf('e1', 'Milch', { quantity: 2, unit: 'l', estimatedCents: 129 }),
      einkauf('e2', 'Vollkornbrot vom Bäcker an der Ecke, nicht das abgepackte', {
        estimatedCents: 349,
      }),
      einkauf('e3', 'Kaffee', { estimatedCents: 699 }),
      einkauf('e4', 'Äpfel', { quantity: 1.5, unit: 'kg' }),
      einkauf('e5', 'Spülmittel', { done: true, doneAt: jetzt }),
      einkauf('e6', 'Butter'),
    ],
    members: [
      { id: m1, name: 'Lukas', color: '#1f6f5c', annualLeaveDays: 30 },
      { id: m2, name: 'Svenja', color: '#a33fb3', annualLeaveDays: 28 },
    ],
    absences: [
      {
        id: 'a1',
        memberId: m1,
        kind: 'urlaub',
        startDate: iso(20),
        endDate: iso(27),
        note: 'Gardasee',
        tripId: 'r1',
        createdAt: jetzt,
      },
    ],
    leaveYears: [],
    anniversaries: [
      {
        id: 'j1',
        title: 'Svenja',
        kind: 'geburtstag',
        month: Number(iso(0).slice(5, 7)),
        day: Number(iso(0).slice(8, 10)),
        sinceYear: 1994,
        leadDays: 7,
        notes: '',
        memberIds: [m2],
        createdAt: jetzt,
      },
      {
        id: 'j2',
        title: 'Hochzeitstag',
        kind: 'jahrestag',
        month: Number(iso(12).slice(5, 7)),
        day: Number(iso(12).slice(8, 10)),
        sinceYear: 2021,
        leadDays: 14,
        notes: '',
        memberIds: [],
        createdAt: jetzt,
      },
    ],
    trips: [
      {
        id: 'r1',
        title: 'Gardasee',
        destination: 'Riva del Garda',
        startDate: iso(20),
        endDate: iso(27),
        notes: '',
        createdAt: jetzt,
      },
    ],
    tripItems: [
      {
        id: 'ri1',
        tripId: 'r1',
        kind: 'packliste',
        title: 'Sonnencreme',
        done: false,
        estimatedCents: null,
        date: null,
        note: '',
        createdAt: jetzt,
      },
    ],
    recipes: [
      { id: 'rz1', title: 'Spaghetti Bolognese', servings: 4, notes: '', createdAt: jetzt },
    ],
    recipeIngredients: [
      {
        id: 'zi1',
        recipeId: 'rz1',
        name: 'Hackfleisch',
        quantity: 500,
        unit: 'g',
        staple: false,
      },
    ],
    meals: [
      {
        id: 'me1',
        date: heute,
        slot: 'abend',
        recipeId: 'rz1',
        title: 'Spaghetti Bolognese',
        servings: 4,
        createdAt: jetzt,
      },
    ],
    expenses: [
      {
        id: 'x1',
        date: heute,
        title: 'Wocheneinkauf Edeka',
        cents: 8734,
        estimatedCents: 8000,
        category: 'Lebensmittel',
        memberIds: [],
        note: '',
        createdAt: jetzt,
      },
      {
        id: 'x2',
        date: iso(-5),
        title: 'Tankfüllung',
        cents: 7210,
        estimatedCents: null,
        category: 'Auto',
        memberIds: [m1],
        note: '',
        createdAt: jetzt,
      },
    ],
    recurringExpenses: [
      {
        id: 'f1',
        title: 'Miete',
        cents: 115000,
        category: 'Wohnen',
        memberIds: [],
        interval: 'monatlich',
        startMonth: `${jahr}-01`,
        endMonth: null,
        note: '',
        createdAt: jetzt,
      },
    ],
    receipts: [],
    trash: [],
    places: [],
    bucket: [
      {
        id: 'k1',
        title: 'Nordlichter in Norwegen sehen',
        note: 'Tromsø, Februar',
        targetYear: jahr + 1,
        memberIds: [],
        done: false,
        doneAt: null,
        createdAt: jetzt,
      },
      {
        id: 'k2',
        title: 'Fallschirmsprung',
        note: '',
        targetYear: null,
        memberIds: [m1],
        done: true,
        doneAt: iso(-100),
        createdAt: jetzt,
      },
    ],
    settings: {
      dayStartMin: 6 * 60,
      dayEndMin: 22 * 60,
      slotMin: 15,
      capacityMin: 8 * 60,
      priceMemory: {},
      personalPhoto: null,
      personalCaption: '',
      bundesland: 'BW',
    },
  };
}
