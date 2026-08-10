import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fehlerText,
  istFaellig,
  istKalender,
  naechsterLauf,
  normalisiereUrl,
  standText,
  type Abo,
} from './abo';

const abo = (patch: Partial<Abo> = {}): Abo => ({
  url: 'https://outlook.office365.com/owa/calendar/x/calendar.ics',
  contextId: 'c1',
  privateContextId: 'c2',
  memberIds: [],
  lastRun: null,
  lastError: null,
  lastCount: 0,
  ...patch,
});

describe('Die Adresse brauchbar machen', () => {
  it('nimmt eine gewöhnliche https-Adresse', () => {
    assert.equal(
      normalisiereUrl('https://outlook.office365.com/owa/calendar/x/calendar.ics'),
      'https://outlook.office365.com/owa/calendar/x/calendar.ics',
    );
  });

  /*
   * `webcal://` ist keine Netzadresse, sondern eine Anweisung ans System –
   * Outlook und Apple geben sie trotzdem gern so heraus.
   */
  it('macht aus webcal eine abrufbare Adresse', () => {
    assert.equal(
      normalisiereUrl('webcal://outlook.office365.com/owa/calendar/x/calendar.ics'),
      'https://outlook.office365.com/owa/calendar/x/calendar.ics',
    );
  });

  it('stört sich nicht an Leerzeichen drumherum', () => {
    assert.equal(normalisiereUrl('  https://a.de/k.ics  '), 'https://a.de/k.ics');
  });

  it('lehnt ab, womit sich nichts anfangen lässt', () => {
    for (const roh of ['', '   ', 'kein-link', 'file:///etc/passwd', 'javascript:alert(1)']) {
      assert.equal(normalisiereUrl(roh), null, roh);
    }
  });
});

describe('Wann wieder abgeglichen wird', () => {
  it('ohne bisherigen Lauf sofort', () => {
    assert.equal(istFaellig(null, '2026-08-10'), true);
  });

  it('nach sieben Tagen wieder', () => {
    assert.equal(istFaellig('2026-08-03', '2026-08-10'), true);
    assert.equal(istFaellig('2026-08-03', '2026-08-09'), false);
  });

  it('sagt, wann es wieder so weit ist', () => {
    assert.equal(naechsterLauf('2026-08-03'), '2026-08-10');
    assert.equal(naechsterLauf(null), null);
  });
});

describe('Warum es nicht geklappt hat', () => {
  /*
   * Der wichtigste Fall: Ein vom Browser abgebrochener Abruf wirft einen
   * nackten TypeError. „Failed to fetch" sagt niemandem etwas – und schon
   * gar nicht, dass der Kalenderanbieter das entscheidet, nicht der Planer.
   */
  it('erklärt die Sperre des Browsers und nennt den Verantwortlichen', () => {
    const text = fehlerText(new TypeError('Failed to fetch'));
    assert.match(text, /Browser darf/);
    assert.match(text, /Anbieter des Kalenders/);
    assert.match(text, /Datei/);
    assert.doesNotMatch(text, /Failed to fetch/);
  });

  it('unterscheidet die üblichen Abweisungen', () => {
    assert.match(fehlerText(null, 403), /abgelehnt/);
    assert.match(fehlerText(null, 404), /liegt nichts/);
    assert.match(fehlerText(null, 503), /antwortet gerade nicht/);
    assert.match(fehlerText(null, 418), /abgewiesen \(418\)/);
  });

  it('nennt eine Zeitüberschreitung beim Namen', () => {
    const err = new Error('abgebrochen');
    err.name = 'AbortError';
    assert.match(fehlerText(err), /zu lange/);
  });
});

describe('Ist das überhaupt ein Kalender', () => {
  it('erkennt eine Kalenderdatei', () => {
    assert.equal(istKalender('BEGIN:VCALENDAR\r\nVERSION:2.0'), true);
    assert.equal(istKalender('\n  BEGIN:VCALENDAR'), true);
  });

  /*
   * Wer die falsche Adresse einfügt, bekommt oft eine Anmeldeseite als HTML.
   * Die als Kalender zu deuten, ergäbe null Termine und keinen Hinweis.
   */
  it('erkennt eine Anmeldeseite als das, was sie ist', () => {
    assert.equal(istKalender('<!DOCTYPE html><html>Bitte anmelden'), false);
  });
});

describe('Was in der Zeile steht', () => {
  it('sagt, wenn noch nichts war', () => {
    assert.match(standText(abo()), /Noch nicht abgeglichen/);
  });

  it('nennt den Fehler, wenn es einen gab', () => {
    assert.match(standText(abo({ lastError: 'Der Browser darf nicht' })), /Zuletzt nicht geklappt/);
  });

  it('beugt den Termin richtig', () => {
    assert.match(standText(abo({ lastRun: '2026-08-10', lastCount: 1 })), /1 Termin übernommen/);
    assert.match(standText(abo({ lastRun: '2026-08-10', lastCount: 4 })), /4 Termine übernommen/);
  });

  it('sagt auch, wenn nichts Neues dabei war', () => {
    assert.match(standText(abo({ lastRun: '2026-08-10', lastCount: 0 })), /nichts Neues/);
  });

  /* Ein Fehler wiegt schwerer als ein alter Erfolg – er steht zuerst. */
  it('nennt den Fehler auch nach einem früheren Erfolg', () => {
    const text = standText(abo({ lastRun: '2026-08-03', lastCount: 9, lastError: 'kaputt' }));
    assert.match(text, /nicht geklappt/);
  });
});
