/*
 * Ein Rundgang durch jede Ansicht – mit vollen Daten, auf zwei Handygrößen und
 * am Rechner, hell und dunkel.
 *
 * Gemessen wird, was man sonst nur zufällig sieht:
 *
 *  - Seite breiter als der Bildschirm (man kann seitlich wischen)
 *  - Elemente, die rechts oder links aus dem Bild ragen
 *  - Text, der abgeschnitten wird, ohne dass es gewollt ist (kein „…")
 *  - Knöpfe und Felder, die sich überdecken
 *  - Schrift unter 12 px
 *  - Fehler in der Konsole oder auf der Seite
 *
 * Absichtlich Gescrolltes (Leisten, die man seitlich wischt) zählt nicht als
 * Überlauf. Bildschirmfotos landen in RUNDGANG_FOTOS, wenn gesetzt.
 *
 * Aufruf (Entwicklungsserver auf 5178): node pruefungen/rundgang.mjs
 */
import { mkdirSync } from 'node:fs';
import { BROWSER, ZIEL, ladePlaywright, mitDaten, zustand } from './testdaten.mjs';

const { chromium, devices } = await ladePlaywright();

const FOTOS = process.env.RUNDGANG_FOTOS ?? '';
if (FOTOS) mkdirSync(FOTOS, { recursive: true });

/* ------------------------------------------------------------ Messen */

async function messen(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const befunde = [];
    const name = (el) => {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
      const text = (el.innerText || el.getAttribute('aria-label') || '')
        .trim()
        .replace(/\s+/g, ' ');
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` „${text.slice(0, 40)}"` : ''}`;
    };
    const sichtbar = (el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      // Deckkraft über die ganze Ahnenreihe: Ein Knopf mit voller Deckkraft
      // in einer unsichtbaren Hülle ist unsichtbar.
      for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
        if (Number(getComputedStyle(p).opacity) === 0) return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // Steckt das Element in etwas, das man absichtlich seitlich wischt?
    const inWischleiste = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
      }
      return false;
    };
    // Liegt das Element unter einer Fläche, die es absichtlich verdeckt
    // (Dialog, Overlay)? Dann ist Überdeckung kein Fehler.
    const festeEbene = (el) => {
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.position === 'fixed' || s.position === 'sticky') return p;
      }
      return null;
    };

    /*
     * Was von einem Element wirklich zu sehen ist. Ein Eintrag, der in einer
     * scrollenden Liste unter der Navigationsleiste liegt, ist dort von der
     * Liste abgeschnitten – er überdeckt die Leiste nicht. Ohne diesen
     * Schnitt meldete der Rundgang 217 Überdeckungen, fast alle falsch.
     */
    const sichtbarerTeil = (el) => {
      const r = el.getBoundingClientRect();
      let { left, top, right, bottom } = r;
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const q = p.getBoundingClientRect();
          left = Math.max(left, q.left);
          top = Math.max(top, q.top);
          right = Math.min(right, q.right);
          bottom = Math.min(bottom, q.bottom);
        }
        if (s.position === 'fixed') break;
      }
      left = Math.max(left, 0);
      top = Math.max(top, 0);
      right = Math.min(right, vw);
      bottom = Math.min(bottom, window.innerHeight);
      return right - left > 1 && bottom - top > 1 ? { left, top, right, bottom } : null;
    };

    if (document.documentElement.scrollWidth > vw + 1) {
      befunde.push(
        `Seite ist ${document.documentElement.scrollWidth - vw} px breiter als der Bildschirm`,
      );
    }

    const alle = [...document.querySelectorAll('body *')].filter(sichtbar);
    for (const el of alle) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);

      // Ragt aus dem Bild – nur das äußerste melden.
      if ((r.right > vw + 1 || r.left < -1) && !inWischleiste(el)) {
        const eltern = el.parentElement?.getBoundingClientRect();
        const elternRagt = eltern && (eltern.right > vw + 1 || eltern.left < -1);
        if (!elternRagt && s.position !== 'fixed') {
          befunde.push(
            `ragt aus dem Bild (${Math.round(r.left)}…${Math.round(r.right)} von ${vw}): ${name(el)}`,
          );
        }
      }

      // Abgeschnittener Text ohne „…".
      const hatText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
      );
      if (hatText) {
        const ellipse = s.textOverflow === 'ellipsis' || Number(s.webkitLineClamp) > 0;
        const schneidetX = /(hidden|clip)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1;
        const schneidetY =
          /(hidden|clip)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2;
        if ((schneidetX || schneidetY) && !ellipse) {
          befunde.push(`Text abgeschnitten (${schneidetX ? 'seitlich' : 'unten'}): ${name(el)}`);
        }
        /*
         * Text, der über sein Kästchen hinausläuft und dabei auf Nachbarn
         * liegt. Bei den festen Kosten bekam „Miete" 27 px und lief über den
         * Betrag daneben – ohne `overflow: hidden` gilt das nicht als
         * abgeschnitten, sieht aber schlimmer aus.
         */
        if (
          !/(hidden|clip|auto|scroll)/.test(s.overflowX) &&
          el.scrollWidth > el.clientWidth + 2 &&
          s.display !== 'inline'
        ) {
          befunde.push(
            `Text läuft über (${el.scrollWidth} statt ${el.clientWidth} px): ${name(el)}`,
          );
        }
        const px = parseFloat(s.fontSize);
        if (px < 12) befunde.push(`Schrift ${px} px: ${name(el)}`);
      }
    }

    // Überdeckte Bedienelemente.
    const bedien = alle.filter((el) =>
      el.matches('button, a[href], input:not([type=hidden]), select, textarea'),
    );
    for (let i = 0; i < bedien.length; i += 1) {
      for (let j = i + 1; j < bedien.length; j += 1) {
        const a = bedien[i];
        const b = bedien[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ea = festeEbene(a);
        const eb = festeEbene(b);
        if (ea !== eb) continue; // verschiedene Ebenen dürfen sich überdecken
        const ra = sichtbarerTeil(a);
        const rb = sichtbarerTeil(b);
        if (!ra || !rb) continue;
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 2 && y > 2) befunde.push(`überdecken sich: ${name(a)} ↔ ${name(b)}`);
      }
    }
    return befunde;
  });
}

/* ------------------------------------------------------------ Rundgang */

const GERAETE = [
  { name: 'Pixel 7', opts: { ...devices['Pixel 7'] } },
  {
    name: 'kleines Android',
    opts: {
      ...devices['Pixel 7'],
      viewport: { width: 360, height: 740 },
      screen: { width: 360, height: 740 },
    },
  },
  { name: 'Rechner', opts: { viewport: { width: 1280, height: 800 } } },
];
const SCHEMEN = ['dark', 'light'];

const browser = await chromium.launch({ executablePath: BROWSER });
const alleBefunde = new Map(); // Befund → Fundorte

/*
 * Selbsttest: Findet die Messung, was sie finden soll? Ein Rundgang mit null
 * Befunden ist nur dann etwas wert, wenn feststeht, dass er Fehler überhaupt
 * sehen kann. Deshalb werden hier absichtlich vier eingebaut.
 */
{
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'de-DE' });
  const page = await context.newPage();
  await page.goto(ZIEL);
  await page.waitForSelector('.topbar');
  await page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    const kiste = document.createElement('div');
    kiste.innerHTML = `
      <div style="position:relative;height:60px">
        <button id="st-a" style="position:absolute;left:10px;top:0;width:120px;height:44px">Selbsttest A</button>
        <button id="st-b" style="position:absolute;left:60px;top:10px;width:120px;height:44px">Selbsttest B</button>
      </div>
      <div style="width:900px">Selbsttest zu breit</div>
      <div style="width:80px;overflow:hidden;white-space:nowrap">Selbsttest abgeschnitten ohne Auslassung</div>
      <div style="font-size:9px">Selbsttest winzig</div>
      <div style="display:flex;width:200px"><span style="flex:1;min-width:0;display:block;white-space:nowrap">Selbsttest läuft über den Nachbarn</span><span style="flex:none;width:150px">Nachbar</span></div>`;
    main.prepend(kiste);
    kiste.scrollIntoView();
  });
  const befunde = await messen(page);
  const erwartet = [
    /überdecken sich: button „Selbsttest A" ↔ button „Selbsttest B"/,
    /breiter als der Bildschirm|ragt aus dem Bild.*Selbsttest zu breit/,
    /Text abgeschnitten.*Selbsttest abgeschnitten/,
    /Schrift 9 px.*Selbsttest winzig/,
    /Text läuft über.*Selbsttest läuft über/,
  ];
  let ok = true;
  for (const muster of erwartet) {
    const gefunden = befunde.some((b) => muster.test(b));
    console.log(`${gefunden ? 'OK  ' : 'FEHL'} Selbsttest erkennt ${muster}`);
    if (!gefunden) ok = false;
  }
  await context.close();
  if (!ok) {
    console.log('\nDie Messung sieht eingebaute Fehler nicht – ihr Ergebnis wäre wertlos.');
    await browser.close();
    process.exit(2);
  }
  console.log('');
}

for (const geraet of GERAETE) {
  for (const schema of SCHEMEN) {
    const context = await browser.newContext({
      ...geraet.opts,
      locale: 'de-DE',
      colorScheme: schema,
    });
    const page = await context.newPage();
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(`Seitenfehler: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|Download the React DevTools/.test(m.text())) {
        fehler.push(`Konsole: ${m.text().slice(0, 160)}`);
      }
    });
    await mitDaten(context, zustand());
    await page.goto(ZIEL);
    await page.waitForSelector('.topbar');
    await page.waitForTimeout(1200);

    const reiter = await page.locator('.tabbar button').allInnerTexts();
    for (let t = 0; t < reiter.length; t += 1) {
      await page.locator('.tabbar button').nth(t).click();
      await page.waitForTimeout(350);
      const reiterName = reiter[t].replace(/\s+/g, ' ').trim();

      // Unteransichten: jede Umschaltleiste im Inhalt.
      const umschalter = page.locator('main [role="tablist"] button, main .segmented button');
      const anzahl = await umschalter.count();
      const stationen = anzahl > 0 ? [...Array(anzahl).keys()] : [null];
      for (const u of stationen) {
        let wo = reiterName;
        if (u !== null) {
          const knopf = umschalter.nth(u);
          if (!(await knopf.isVisible().catch(() => false))) continue;
          wo += ` → ${(await knopf.innerText()).replace(/\s+/g, ' ').trim()}`;
          await knopf.click().catch(() => {});
          await page.waitForTimeout(300);
        }
        /*
         * Zeiger aus dem Weg. Sonst gilt das zuletzt Angeklickte als
         * „überfahren", und Aktionen, die nur dann erscheinen (das „×" an
         * einem Termin), liegen über ihrem Block – gewollt, aber kein
         * Ruhezustand.
         */
        await page.mouse.move(1, 1);
        await page
          .locator('.topbar')
          .first()
          .hover({ position: { x: 5, y: 5 } })
          .catch(() => {});
        const befunde = await messen(page);
        for (const b of befunde) {
          const ort = `${geraet.name}/${schema}: ${wo}`;
          if (!alleBefunde.has(b)) alleBefunde.set(b, []);
          alleBefunde.get(b).push(ort);
        }
        if (FOTOS && schema === 'dark' && geraet.name !== 'Rechner') {
          const datei = `${FOTOS}/${geraet.name.replace(/\s/g, '_')}-${wo.replace(/[^a-zA-Z0-9äöüÄÖÜ]+/g, '_')}.png`;
          await page.screenshot({ path: datei, fullPage: true });
        }
      }
    }
    for (const f of fehler) {
      const ort = `${geraet.name}/${schema}`;
      if (!alleBefunde.has(f)) alleBefunde.set(f, []);
      alleBefunde.get(f).push(ort);
    }
    await context.close();
  }
}
await browser.close();

if (alleBefunde.size === 0) {
  console.log('Keine Befunde.');
  process.exit(0);
}
console.log(`${alleBefunde.size} Befunde:\n`);
for (const [befund, orte] of alleBefunde) {
  const kurz = [...new Set(orte)];
  console.log(`FEHL ${befund}`);
  console.log(
    `     ${kurz.slice(0, 4).join(' | ')}${kurz.length > 4 ? ` (+${kurz.length - 4})` : ''}`,
  );
}
process.exit(1);
