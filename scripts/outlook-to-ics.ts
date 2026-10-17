#!/usr/bin/env -S npx tsx
/*
 * Macht aus Outlook-Terminen eine Kalenderdatei für den Planer.
 *
 *     npx tsx scripts/outlook-to-ics.ts termine.json arbeitskalender.ics
 *
 * Gedacht für den wöchentlichen Übertrag: Der Arbeitskalender wird gelesen,
 * seine Einträge landen als JSON in der Eingabedatei, und hier wird daraus
 * eine `.ics`, die unter *Mehr → Kalender* eingelesen wird – mit Vorschau,
 * mit Bereichswahl, und ohne Doppel beim zweiten Mal.
 *
 * Die Umwandlung selbst steht in `src/domain/outlook.ts` und ist dort
 * geprüft, bis hin zum Rundlauf durch den eigenen Importeur. Hier steht nur
 * das Drumherum: lesen, schreiben, berichten.
 *
 * Die Eingabe darf schlampig sein. Was eine Kalenderabfrage herausgibt, ist
 * oft keine saubere Liste, sondern ein Objekt neben dem anderen – und am
 * Ende eines, das nur sagt, dass es weitere Seiten gibt. Beides wird hier
 * verkraftet, weil die Alternative ist, dass jemand es von Hand zu einer
 * Liste zusammenschiebt und sich dabei verschreibt.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildIcs } from '../src/domain/ics.ts';
import { ausOutlook, type OutlookEvent } from '../src/domain/outlook.ts';

/**
 * Trennt aneinandergereihte JSON-Objekte.
 *
 * Gezählt wird die Klammertiefe, und zwar außerhalb von Zeichenketten: Ein
 * `}` in einem Betreff darf nicht als Ende eines Objekts gelten. Der
 * Rückwärtsstrich zählt doppelt, sonst beendet `\"` die Zeichenkette.
 */
function einzelneObjekte(text: string): string[] {
  const teile: string[] = [];
  let tiefe = 0;
  let start = -1;
  let inText = false;
  let maskiert = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inText) {
      if (maskiert) maskiert = false;
      else if (c === '\\') maskiert = true;
      else if (c === '"') inText = false;
      continue;
    }
    if (c === '"') inText = true;
    else if (c === '{') {
      if (tiefe === 0) start = i;
      tiefe += 1;
    } else if (c === '}') {
      tiefe -= 1;
      if (tiefe === 0 && start >= 0) {
        teile.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return teile;
}

function leseEintraege(pfad: string): OutlookEvent[] {
  const text = readFileSync(pfad, 'utf8');
  let roh: unknown[];
  try {
    const geparst: unknown = JSON.parse(text);
    roh = Array.isArray(geparst) ? geparst : [geparst];
  } catch {
    roh = einzelneObjekte(text).map((t) => JSON.parse(t) as unknown);
  }
  /*
   * Was weder Betreff noch Beginn hat, ist kein Termin, sondern die
   * Randnotiz einer Abfrage („es gibt weitere Seiten"). Die wird still
   * weggelassen – sie als „Termin ohne Betreff" zu melden, wäre Lärm, der
   * von den echten Meldungen ablenkt.
   */
  return roh.filter(
    (e): e is OutlookEvent =>
      typeof e === 'object' && e !== null && ('subject' in e || 'start' in e),
  );
}

const [eingabe, ausgabe] = process.argv.slice(2);
if (!eingabe || !ausgabe) {
  console.error('Aufruf: npx tsx scripts/outlook-to-ics.ts <termine.json> <ziel.ics>');
  process.exit(2);
}

const eintraege = leseEintraege(eingabe);
const { events, uebergangen } = ausOutlook(eintraege);
writeFileSync(ausgabe, buildIcs(events), 'utf8');

const tage = [...new Set(events.map((e) => e.date))].sort();
console.log(`${eintraege.length} gelesen, ${events.length} übernommen → ${ausgabe}`);
if (tage.length) console.log(`Zeitraum: ${tage[0]} bis ${tage[tage.length - 1]}`);
if (uebergangen.length) {
  console.log(`Nicht übernommen (${uebergangen.length}):`);
  for (const z of uebergangen) console.log(`  – ${z}`);
}
