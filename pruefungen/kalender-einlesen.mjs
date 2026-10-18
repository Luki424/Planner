/*
 * Ein Kalender muss sich auch dann einlesen lassen, wenn die Datei hakt.
 *
 * Gemeldet: „Ich kann die Datei immer noch nicht einlesen." Am Handy kam die
 * Datei gar nicht im Planer an – Android zeigte nur eine graue Blase („Zu
 * wenig Speicher für vorherige Operation"), der Planer erfuhr davon nichts.
 * Dazu kamen zwei Stellen im Planer selbst, an denen ein zweiter Versuch
 * stumm ins Leere lief:
 *
 *  1. Nach einem Fehlschlag blieb die Datei im Auswahlfeld stehen. Wer
 *     dieselbe Datei erneut wählte, löste keine Änderung aus – es geschah
 *     nichts.
 *  2. Der Filter ließ nur `text/calendar` durch. Am Handy trägt eine .ics,
 *     die eine andere App gespeichert hat, oft „application/octet-stream" und
 *     ist dann ausgegraut.
 *
 * Und der Weg, der an der Dateiauswahl ganz vorbeigeht: Text einfügen.
 *
 * Aufruf (Entwicklungsserver auf 5178): node pruefungen/kalender-einlesen.mjs
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

// Ein erfundener Kalender – drei Termine, einer davon mit Komma im Titel.
const tag = (d) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}`;
};
const KALENDER = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  `UID:pruefung-1@beispiel`,
  `DTSTART:${tag(3)}T090000`,
  `DTEND:${tag(3)}T100000`,
  'SUMMARY:Teambesprechung',
  'END:VEVENT',
  'BEGIN:VEVENT',
  `UID:pruefung-2@beispiel`,
  `DTSTART:${tag(4)}T140000`,
  `DTEND:${tag(4)}T153000`,
  'SUMMARY:Werksbesuch\\, zweiter Teil',
  'END:VEVENT',
  'BEGIN:VEVENT',
  `UID:pruefung-3@beispiel`,
  `DTSTART;VALUE=DATE:${tag(5)}`,
  `DTEND;VALUE=DATE:${tag(6)}`,
  'SUMMARY:Bereitschaft',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n');

const browser = await chromium.launch({ executablePath: BROWSER });
const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'de-DE' });
const page = await context.newPage();
const seitenfehler = [];
page.on('pageerror', (e) => seitenfehler.push(String(e)));
await page.goto(ZIEL);
await page.waitForSelector('.topbar');
await page.waitForTimeout(1200);
await page.click('.tabbar button:has-text("Mehr")');
await page.waitForSelector('input[aria-label="Kalenderdatei"]', { state: 'attached' });

/* ---------- 1. Filter ---------- */
const accept = await page.getAttribute('input[aria-label="Kalenderdatei"]', 'accept');
pruefe(
  'die Auswahl lässt auch allgemein gespeicherte Dateien zu',
  (accept ?? '').includes('application/octet-stream'),
  accept ?? '(kein Filter)',
);

/* ---------- 2. Nach einem Fehlschlag ist das Feld wieder leer ---------- */
await page.setInputFiles('input[aria-label="Kalenderdatei"]', {
  name: 'notiz.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('Das ist kein Kalender.'),
});
await page.waitForTimeout(300);
pruefe(
  'eine falsche Datei wird gemeldet',
  await page.getByText('Das sieht nicht nach einer Kalenderdatei aus.').isVisible(),
);
const wertDanach = await page.$eval('input[aria-label="Kalenderdatei"]', (el) => el.value);
pruefe(
  'danach ist das Auswahlfeld leer – ein zweiter Versuch mit derselben Datei kommt an',
  wertDanach === '',
  wertDanach ? `steht noch: ${wertDanach}` : '',
);

/* ---------- 3. Text einfügen ---------- */
const knopf = page.locator('button', { hasText: 'Text einfügen' });
pruefe('es gibt „Text einfügen"', (await knopf.count()) === 1);
if ((await knopf.count()) === 1) {
  await knopf.click();
  await page.fill('.ics-einfuegen textarea', KALENDER);
  await page.click('.ics-einfuegen button:has-text("Lesen")');
  await page.waitForSelector('.ics-preview', { timeout: 3000 }).catch(() => {});
  const vorschau = (
    await page
      .locator('.ics-preview')
      .innerText()
      .catch(() => '')
  ).replace(/\n/g, ' ');
  pruefe(
    'eingefügter Text ergibt eine Vorschau mit drei Terminen',
    /3 Termine/.test(vorschau),
    vorschau.slice(0, 90),
  );

  await page.click('.ics-preview button:has-text("Übernehmen")').catch(() => {});
  await page.waitForTimeout(300);
  pruefe(
    'nach dem Übernehmen steht da, wie viele es waren',
    await page
      .getByText('3 Termine übernommen.')
      .isVisible()
      .catch(() => false),
  );

  // Ein zweites Mal: nichts doppelt.
  await knopf.click();
  await page.fill('.ics-einfuegen textarea', KALENDER);
  await page.click('.ics-einfuegen button:has-text("Lesen")');
  await page.click('.ics-preview button:has-text("Übernehmen")').catch(() => {});
  await page.waitForTimeout(300);
  pruefe(
    'derselbe Text ein zweites Mal legt nichts doppelt an',
    await page
      .getByText('0 übernommen, 3 waren schon da.')
      .isVisible()
      .catch(() => false),
  );
}

pruefe('keine Fehler auf der Seite', seitenfehler.length === 0, seitenfehler.join(' | '));
await browser.close();
console.log(fehler === 0 ? '\nAlles grün' : `\n${fehler} fehlgeschlagen`);
process.exit(fehler === 0 ? 0 : 1);
