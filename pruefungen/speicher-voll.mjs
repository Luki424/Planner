/*
 * Wenn der Browser keine Daten mehr annimmt, muss das dastehen.
 *
 * Scheiterte ein Schreibvorgang, fiel die Ablage still auf den
 * Arbeitsspeicher zurück, und von da an war jede Eingabe nur bis zum
 * nächsten Neuladen da. Die Oberfläche sah dabei aus wie immer.
 *
 * Geprüft wird in beide Richtungen, denn nur so ist die Prüfung etwas wert:
 *
 *  1. Schreiben scheitert  → der Streifen steht da, samt Meldung des Browsers.
 *  2. Schreiben geht       → kein Streifen. Eine Warnung, die immer da ist,
 *                            ist keine Warnung.
 *
 * Aufruf (Entwicklungsserver auf 5178):
 *   NODE_PATH=/opt/node-tools/node_modules node pruefungen/speicher-voll.mjs
 */
import { createRequire } from 'node:module';

/*
 * Playwright liegt in dieser Umgebung nicht im Projekt, sondern global. Ein
 * `import 'playwright'` scheitert deshalb – die Auflösung für ES-Module geht
 * nicht über NODE_PATH. Über `createRequire` tut sie es.
 */
const { chromium, devices } = await (async () => {
  const require = createRequire(import.meta.url);
  const kandidaten = [
    process.env.PLAYWRIGHT_PACKAGE,
    'playwright',
    '/usr/local/lib/node_modules_global/playwright',
    '/opt/node-tools/node_modules/playwright',
  ].filter(Boolean);
  for (const kandidat of kandidaten) {
    try {
      return require(kandidat);
    } catch {
      // nächsten versuchen
    }
  }
  throw new Error('Playwright nicht gefunden. Setze PLAYWRIGHT_PACKAGE auf den Pfad des Pakets.');
})();

const ZIEL = process.env.PLANER_URL ?? 'http://localhost:5178/';
const BROWSER =
  process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: BROWSER });

let fehler = 0;
const pruefe = (titel, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${titel}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fehler += 1;
};

/**
 * Lässt jeden Schreibvorgang in IndexedDB scheitern – so, wie es ein
 * Browser bei knappem Platz tut. Das Öffnen bleibt erlaubt: Sonst wiche die
 * App auf localStorage aus und prüfte einen anderen Fall als den gemeldeten.
 */
const SPEICHER_VOLL = () => {
  const echt = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    void echt;
    void args;
    throw new DOMException('Zu wenig Speicher für vorherige Operation.', 'QuotaExceededError');
  };
};

async function lauf(name, { vollerSpeicher }) {
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'de-DE' });
  const page = await context.newPage();
  if (vollerSpeicher) await page.addInitScript(SPEICHER_VOLL);
  await page.goto(ZIEL);
  await page.waitForSelector('.topbar');
  await page.waitForTimeout(1500);

  // Irgendetwas eintragen – erst dann wird geschrieben.
  await page.locator('button', { hasText: 'Pool (' }).first().click();
  await page.waitForSelector('.quick-add input');
  await page.locator('.quick-add input').first().fill('Prüfung Speicher');
  await page.locator('.quick-add button[type="submit"]').click();
  // 250 ms Verzögerung beim Speichern, dazu der Weg durch IndexedDB.
  await page.waitForTimeout(1500);

  const sichtbar = await page
    .locator('.speicher-warnung')
    .isVisible()
    .catch(() => false);
  const text = sichtbar ? await page.locator('.speicher-warnung').innerText() : '';
  await context.close();
  return { name, sichtbar, text };
}

const voll = await lauf('voller Speicher', { vollerSpeicher: true });
pruefe('Schreiben scheitert → der Streifen steht da', voll.sichtbar);
pruefe(
  'der Streifen nennt die Meldung des Browsers',
  voll.text.includes('Zu wenig Speicher für vorherige Operation.'),
  voll.text.slice(0, 120).replace(/\n/g, ' '),
);
pruefe(
  'der Streifen sagt, was das heißt',
  /nach einem Neuladen weg/.test(voll.text),
  voll.text.slice(0, 120).replace(/\n/g, ' '),
);
pruefe(
  'der Streifen hat kein „Schließen"',
  !/Schließen/.test(voll.text),
  'ein wegtippbarer Hinweis ist nach dem ersten Mal nicht mehr da',
);

const frei = await lauf('freier Speicher', { vollerSpeicher: false });
pruefe('Schreiben geht → kein Streifen', !frei.sichtbar, frei.text.slice(0, 120));

await browser.close();
console.log(fehler === 0 ? '\nAlles grün' : `\n${fehler} fehlgeschlagen`);
process.exit(fehler === 0 ? 0 : 1);
