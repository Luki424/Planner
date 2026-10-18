/*
 * Was der Rundgang durch alle Ansichten gefunden hat – als Zusicherungen.
 *
 * Gemessen an einem Pixel 7, mit den vollen Testdaten aus testdaten.mjs:
 *
 *  - Aufgabenkarte: Dem Titel blieben 89 px, „Steuererklärung" brach als
 *    „Steuererkl / ärung" um.
 *  - Termin über 4½ Stunden: Titel einzeilig mit „Batte…", darunter leerer
 *    Block.
 *  - Feste Kosten: 27 px für „Miete", der Text lief über den Betrag.
 *  - Einkaufsliste: „1.5 kg" statt „1,5 kg".
 *  - Essensplan: „1 Zutaten".
 *  - Kalender: drei Knöpfe als Treppe.
 *  - Häkchen im Pool: Rahmen mit 1,03 : 1 Kontrast, also unsichtbar.
 *
 * Aufruf (Entwicklungsserver auf 5178): node pruefungen/karten.mjs
 */
import { BROWSER, ZIEL, ladePlaywright, mitDaten, zustand } from './testdaten.mjs';

const { chromium, devices } = await ladePlaywright();

let fehler = 0;
const pruefe = (titel, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${titel}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fehler += 1;
};

const browser = await chromium.launch({ executablePath: BROWSER });
const context = await browser.newContext({
  ...devices['Pixel 7'],
  locale: 'de-DE',
  colorScheme: 'dark',
});
await mitDaten(context, zustand());
const page = await context.newPage();
await page.goto(ZIEL);
await page.waitForSelector('.topbar');
await page.waitForTimeout(1200);

const reiter = async (name, unter = null) => {
  await page.click(`.tabbar button:has-text("${name}")`);
  await page.waitForTimeout(300);
  if (unter) {
    await page.locator(`button:has-text("${unter}")`).first().click();
    await page.waitForTimeout(300);
  }
};

/* ---------- Aufgabenkarte ---------- */
await reiter('Liste');
const titelBreiten = await page.$$eval('.todo-row .todo-title', (els) =>
  els.map((e) => Math.round(e.getBoundingClientRect().width)),
);
pruefe(
  'Aufgabenkarte: jeder Titel hat mindestens 150 px',
  titelBreiten.length > 0 && titelBreiten.every((b) => b >= 150),
  titelBreiten.join(', ') + ' px',
);

/* ---------- Langer Termin ---------- */
await reiter('Tag');
const workshop = await page.evaluate(() => {
  const t = [...document.querySelectorAll('.block .block-title')].find((e) =>
    e.innerText.startsWith('CHARGE'),
  );
  if (!t) return null;
  const zeile = parseFloat(getComputedStyle(t).lineHeight) || 18;
  return {
    zeilen: Math.round(t.getBoundingClientRect().height / zeile),
    weiss: getComputedStyle(t).whiteSpace,
  };
});
pruefe(
  'langer Termin: der Titel darf über mehrere Zeilen gehen',
  workshop !== null && workshop.zeilen >= 2,
  workshop ? `${workshop.zeilen} Zeile(n), white-space: ${workshop.weiss}` : 'Block fehlt',
);

/* ---------- Häkchen im Pool ---------- */
await page.locator('button:has-text("Pool (")').first().click();
await page.waitForTimeout(300);
const kontrast = await page.evaluate(() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d');
  const rgb = (f) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000';
    cx.fillStyle = f;
    cx.fillRect(0, 0, 1, 1);
    return [...cx.getImageData(0, 0, 1, 1).data];
  };
  const hell = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const el = document.querySelector('.backlog .task-card .check');
  if (!el) return null;
  let grund = [0, 0, 0, 255];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const v = rgb(getComputedStyle(p).backgroundColor);
    if (v[3] > 250) {
      grund = v;
      break;
    }
  }
  const [a, b] = [hell(rgb(getComputedStyle(el).borderTopColor)), hell(grund)].sort(
    (x, y) => y - x,
  );
  return (a + 0.05) / (b + 0.05);
});
pruefe(
  'Häkchen im Pool: Rahmen mit mindestens 3 : 1',
  kontrast !== null && kontrast >= 3,
  kontrast ? `${kontrast.toFixed(2)} : 1` : 'fehlt',
);

/* ---------- Einkaufsliste ---------- */
await reiter('Einkauf');
const liste = await page.locator('main').innerText();
pruefe('Menge mit Komma: „1,5 kg"', liste.includes('1,5 kg') && !liste.includes('1.5 kg'));

/* ---------- Essensplan ---------- */
await reiter('Einkauf', 'Essensplan');
const essen = await page.locator('main').innerText();
pruefe('„1 Zutat", nicht „1 Zutaten"', /\b1 Zutat\b/.test(essen) && !/\b1 Zutaten\b/.test(essen));

/* ---------- Feste Kosten ---------- */
await reiter('Einkauf', 'Ausgaben');
const miete = await page.evaluate(() => {
  const li = [...document.querySelectorAll('.shopping-row')].find((l) =>
    l.innerText.includes('Miete'),
  );
  return li ? Math.round(li.querySelector('.shopping-main').getBoundingClientRect().width) : null;
});
pruefe(
  'feste Kosten: der Text hat mindestens 150 px',
  miete !== null && miete >= 150,
  `${miete} px`,
);

/* ---------- Kalender ---------- */
await reiter('Mehr');
const knoepfe = await page.evaluate(() => {
  const gruppe = [...document.querySelectorAll('.settings-group')].find(
    (g) => g.querySelector('h3')?.textContent === 'Kalender',
  );
  return [...gruppe.querySelectorAll('.button-row')[0].querySelectorAll('.btn')].map((b) => {
    const r = b.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.width)];
  });
});
const gleich = knoepfe.every(([l, w]) => l === knoepfe[0][0] && w === knoepfe[0][1]);
pruefe(
  'Kalender: die drei Knöpfe stehen bündig untereinander',
  knoepfe.length === 3 && gleich,
  knoepfe.map(([l, w]) => `${l}+${w}`).join(' | '),
);

await browser.close();
console.log(fehler === 0 ? '\nAlles grün' : `\n${fehler} fehlgeschlagen`);
process.exit(fehler === 0 ? 0 : 1);
