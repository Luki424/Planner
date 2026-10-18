/*
 * Die Zeitachse soll dort aufgehen, wo es etwas zu sehen gibt.
 *
 * Gefunden beim Rundgang: Ein Tag mit einem ganztägigen Eintrag ging immer
 * bei 06:00 auf. Ganztägiges wird mit Beginn 0:00 gespeichert und galt damit
 * als „frühester Termin". Seit die Bereitschaften aus Outlook hereinkommen,
 * betraf das jeden zweiten Tag.
 *
 * Zwei Zusicherungen, die Uhr fest auf 13:30:
 *
 *  1. Heute, mit Bereitschaft und einem Termin um neun: Die Linie „jetzt"
 *     ist zu sehen.
 *  2. Morgen, mit Bereitschaft und einem Termin um 14 Uhr: Der Termin ist
 *     zu sehen.
 *
 * Aufruf (Entwicklungsserver auf 5178): node pruefungen/zeitachse.mjs
 */
import { createRequire } from 'node:module';

const { chromium, devices } = await (async () => {
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
})();

const ZIEL = process.env.PLANER_URL ?? 'http://localhost:5178/';
const BROWSER =
  process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let fehler = 0;
const pruefe = (titel, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${titel}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fehler += 1;
};

const HEUTE = '2026-10-21';
const MORGEN = '2026-10-22';
const block = (id, date, start, dauer, title, allDay = false) => ({
  id,
  date,
  startMin: start,
  durationMin: dauer,
  allDay,
  taskId: null,
  title,
  notes: '',
  contextId: 'c1',
  memberIds: [],
});
const ZUSTAND = {
  version: 1,
  contexts: [{ id: 'c1', name: 'Beruflich', color: '#3b82f6' }],
  blocks: [
    block('a1', HEUTE, 0, 0, 'Bereitschaft', true),
    block('a2', HEUTE, 9 * 60, 60, 'Termin am Morgen'),
    block('b1', MORGEN, 0, 0, 'Bereitschaft', true),
    block('b2', MORGEN, 14 * 60, 60, 'Termin am Nachmittag'),
  ],
};

const browser = await chromium.launch({ executablePath: BROWSER });
const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'de-DE' });
await context.addInitScript(
  ({ zustand }) => {
    const fest = new Date('2026-10-21T13:30:00');
    const Echt = Date;
    class Fix extends Echt {
      constructor(...a) {
        super(...(a.length ? a : [fest]));
      }
      static now() {
        return fest.getTime();
      }
    }
    globalThis.Date = Fix;
    if (!sessionStorage.getItem('gesetzt')) {
      localStorage.setItem('planner:mirror', JSON.stringify(zustand));
      sessionStorage.setItem('gesetzt', '1');
    }
  },
  { zustand: ZUSTAND },
);
const page = await context.newPage();
await page.goto(ZIEL);
await page.waitForSelector('.timeline');
await page.waitForTimeout(800);

/** Liegt das Element im sichtbaren Teil der scrollenden Zeitachse? */
const imBild = (sel, text = null) =>
  page.evaluate(
    ([s, t]) => {
      const el = [...document.querySelectorAll(s)].find((e) => !t || e.innerText.includes(t));
      if (!el) return 'fehlt';
      let box = el.parentElement;
      while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
      const r = el.getBoundingClientRect();
      const q = box.getBoundingClientRect();
      return r.top < q.bottom && r.bottom > q.top ? 'ja' : `nein (scrollTop ${box.scrollTop})`;
    },
    [sel, text],
  );

const jetzt = await imBild('.now-line');
pruefe('heute, mit Bereitschaft: die Linie „jetzt" ist zu sehen', jetzt === 'ja', jetzt);

await page.locator('button[aria-label="Weiter"]').first().click();
await page.waitForTimeout(500);
const nachmittag = await imBild('.block', 'Termin am Nachmittag');
pruefe(
  'morgen, mit Bereitschaft: der Termin um 14 Uhr ist zu sehen',
  nachmittag === 'ja',
  nachmittag,
);

await browser.close();
console.log(fehler === 0 ? '\nAlles grün' : `\n${fehler} fehlgeschlagen`);
process.exit(fehler === 0 ? 0 : 1);
