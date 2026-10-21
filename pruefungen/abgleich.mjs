/*
 * Verschobene und entfallene Termine beim erneuten Einlesen.
 *
 * Nachgestellt, wie es am 21.10. tatsächlich war: Im Planer stehen die
 * Einträge vom Montag. Laut neuer, vollständiger Datei sind „Gefahrgutversand"
 * und „Meeting TBB-BVD" verschoben, die „Ausschreibung" ist entfallen. Ein
 * eigener Termin und ein vergangener Kick-Off dürfen nicht angefasst werden.
 *
 * Und die Gegenrichtung: Ein kurzer Text mit nur den neuen Einträgen sagt
 * nichts über das, was fehlt – dann darf es keinen Abgleich geben.
 *
 * Aufruf (Entwicklungsserver auf 5178): node pruefungen/abgleich.mjs
 */
import { BROWSER, ZIEL, ladePlaywright, mitDaten } from './testdaten.mjs';

const { chromium, devices } = await ladePlaywright();

let fehler = 0;
const pruefe = (titel, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${titel}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fehler += 1;
};

const Q = '@outlook.bvd';
const block = (uid, date, start, title, extra = {}) => ({
  id: `b-${title}-${date}`.replace(/\s/g, '_'),
  date,
  startMin: start,
  durationMin: 60,
  taskId: null,
  title,
  notes: '',
  contextId: 'c1',
  memberIds: [],
  ...(uid ? { icsUid: uid } : {}),
  ...extra,
});

const ZUSTAND = {
  version: 1,
  contexts: [{ id: 'c1', name: 'Beruflich', color: '#3b82f6' }],
  blocks: [
    block(`kick-off-20261019t1100${Q}`, '2026-10-19', 660, 'Monday-Kick-Off'),
    block(
      `gefahrgutversand-per-dpd-20261021t0900${Q}`,
      '2026-10-21',
      540,
      'Gefahrgutversand per DPD',
    ),
    block(`meeting-tbb-20261021t1000${Q}`, '2026-10-21', 600, 'Meeting TBB-BVD'),
    block(`ausschreibung-20261022t1500${Q}`, '2026-10-22', 900, 'Ausschreibung'),
    block(null, '2026-10-22', 480, 'Zahnarzt'),
    block(`kick-off-20261026t1100${Q}`, '2026-10-26', 660, 'Monday-Kick-Off'),
  ],
};

const ereignis = (uid, tag, von, bis, titel) =>
  [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${tag}T${von}00`,
    `DTEND:${tag}T${bis}00`,
    `SUMMARY:${titel}`,
    'END:VEVENT',
  ].join('\n');

const VOLL = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'X-TAGESPLANER-VOLLSTAENDIG:20261021/20261202',
  ereignis(
    `gefahrgutversand-per-dpd-20261022t1000${Q}`,
    '20261022',
    '1000',
    '1100',
    'Gefahrgutversand per DPD',
  ),
  ereignis(`meeting-tbb-20261026t1000${Q}`, '20261026', '1000', '1100', 'Meeting TBB-BVD'),
  ereignis(`kick-off-20261026t1100${Q}`, '20261026', '1100', '1200', 'Monday-Kick-Off'),
  'END:VCALENDAR',
  '',
].join('\n');

const NUR_NEU = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  ereignis(`kick-off-20261130t1100${Q}`, '20261130', '1100', '1200', 'Monday-Kick-Off'),
  'END:VCALENDAR',
  '',
].join('\n');

async function seite() {
  const browser = await chromium.launch({ executablePath: BROWSER });
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'de-DE' });
  await context.addInitScript(() => {
    const fest = new Date('2026-10-21T10:00:00');
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
  });
  await mitDaten(context, ZUSTAND);
  const page = await context.newPage();
  await page.goto(ZIEL);
  await page.waitForSelector('.topbar');
  await page.waitForTimeout(1000);
  await page.click('.tabbar button:has-text("Mehr")');
  await page.waitForTimeout(300);
  return { browser, page };
}

async function einfuegen(page, text) {
  await page.locator('button', { hasText: 'Text einfügen' }).click();
  await page.fill('.ics-einfuegen textarea', text);
  await page.click('.ics-einfuegen button:has-text("Lesen")');
  await page.waitForSelector('.ics-preview');
}

/** Liest den gespeicherten Stand aus IndexedDB – nach dem verzögerten Speichern. */
const gespeichert = (page) =>
  page.evaluate(
    () =>
      new Promise((ok, nein) => {
        const r = indexedDB.open('planner');
        r.onerror = () => nein(r.error);
        r.onsuccess = () => {
          const g = r.result.transaction('state').objectStore('state').get('app');
          g.onsuccess = () => ok(g.result);
          g.onerror = () => nein(g.error);
        };
      }),
  );

/* ---------- vollständige Datei ---------- */
{
  const { browser, page } = await seite();
  await einfuegen(page, VOLL);
  const vorschau = (await page.locator('.ics-preview').innerText()).replace(/\s+/g, ' ');
  const abschnitt = (
    await page
      .locator('.abgleich')
      .innerText()
      .catch(() => '')
  ).replace(/\s+/g, ' ');

  pruefe(
    'die Vorschau zeigt den Abgleich',
    abschnitt.length > 0,
    abschnitt ? '' : vorschau.slice(0, 120),
  );
  pruefe(
    'Gefahrgutversand: verschoben von Mi 21.10. 09:00 auf Do 22.10. 10:00',
    /Gefahrgutversand per DPD Mi 21\.10\. 09:00 → Do 22\.10\. 10:00/.test(abschnitt),
  );
  pruefe(
    'Meeting TBB-BVD: verschoben auf Mo 26.10.',
    /Meeting TBB-BVD Mi 21\.10\. 10:00 → Mo 26\.10\. 10:00/.test(abschnitt),
  );
  pruefe(
    'Ausschreibung: nicht mehr im Kalender',
    /Nicht mehr im Kalender.*Ausschreibung Do 22\.10\. 15:00/i.test(abschnitt),
  );
  pruefe('der eigene Termin steht nicht im Abgleich', !abschnitt.includes('Zahnarzt'));
  pruefe('der vergangene Kick-Off steht nicht im Abgleich', !abschnitt.includes('19.10.'));

  await page.click('.ics-preview button:has-text("Übernehmen")');
  await page.waitForTimeout(800);
  const meldung = (
    await page.locator('.settings-group:has(h3:text-is("Kalender"))').innerText()
  ).replace(/\s+/g, ' ');
  pruefe(
    'die Meldung nennt die entfernten',
    /3 alte Einträge entfernt \(im Papierkorb\)/.test(meldung),
    meldung.match(/\d+ (Termin|übernommen)[^.]*\./)?.[0] ?? '',
  );

  const stand = await gespeichert(page);
  const titelAm = (date) =>
    stand.blocks
      .filter((b) => b.date === date)
      .map((b) => b.title)
      .sort();
  pruefe(
    '21.10.: die alten Einträge sind weg',
    titelAm('2026-10-21').length === 0,
    titelAm('2026-10-21').join(', '),
  );
  pruefe(
    '22.10.: Gefahrgutversand neu, Zahnarzt bleibt, Ausschreibung weg',
    JSON.stringify(titelAm('2026-10-22')) ===
      JSON.stringify(['Gefahrgutversand per DPD', 'Zahnarzt']),
    titelAm('2026-10-22').join(', '),
  );
  pruefe(
    '26.10.: Kick-Off genau einmal, TBB-BVD neu',
    JSON.stringify(titelAm('2026-10-26')) ===
      JSON.stringify(['Meeting TBB-BVD', 'Monday-Kick-Off']),
    titelAm('2026-10-26').join(', '),
  );
  pruefe(
    '19.10.: der vergangene Kick-Off bleibt',
    titelAm('2026-10-19').includes('Monday-Kick-Off'),
  );
  const korb = stand.trash.filter((e) => e.label === 'Abgleich mit dem Kalender');
  pruefe(
    'alles Entfernte liegt in einem Papierkorb-Eintrag',
    korb.length === 1 && korb[0].items.length === 3,
    `${korb.length} Einträge`,
  );
  await browser.close();
}

/* ---------- abgewählt bleibt ---------- */
{
  const { browser, page } = await seite();
  await einfuegen(page, VOLL);
  await page
    .locator('.abgleich-liste li', { hasText: 'Ausschreibung' })
    .locator('input[type="checkbox"]')
    .uncheck();
  await page.click('.ics-preview button:has-text("Übernehmen")');
  await page.waitForTimeout(800);
  const stand = await gespeichert(page);
  const titel = stand.blocks.filter((b) => b.date === '2026-10-22').map((b) => b.title);
  pruefe(
    'abgewählt: die Ausschreibung bleibt stehen',
    titel.includes('Ausschreibung'),
    titel.join(', '),
  );
  pruefe(
    '… die beiden Verschobenen sind trotzdem ersetzt',
    !stand.blocks.some((b) => b.date === '2026-10-21'),
  );
  await browser.close();
}

/* ---------- kurzer Text ohne Zusage ---------- */
{
  const { browser, page } = await seite();
  await einfuegen(page, NUR_NEU);
  const hatAbgleich = (await page.locator('.abgleich').count()) > 0;
  pruefe('kurzer Text ohne Zusage „vollständig": kein Abgleich', !hatAbgleich);
  await page.click('.ics-preview button:has-text("Übernehmen")');
  await page.waitForTimeout(800);
  const stand = await gespeichert(page);
  pruefe(
    '… und nichts wird entfernt',
    stand.blocks.length === ZUSTAND.blocks.length + 1,
    `${stand.blocks.length} Blöcke`,
  );
  await browser.close();
}

console.log(fehler === 0 ? '\nAlles grün' : `\n${fehler} fehlgeschlagen`);
process.exit(fehler === 0 ? 0 : 1);
