import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseUtterance } from './voice';

// Fester Bezugstag: Dienstag, 4. August 2026.
const HEUTE = '2026-08-04';

describe('Einkaufsliste', () => {
  const shopping = (text: string) => {
    const result = parseUtterance(text, HEUTE, 'shopping');
    assert.ok(result && result.kind === 'shopping', `nicht als Einkauf erkannt: ${text}`);
    return result.items;
  };

  it('erkennt einen schlichten Eintrag', () => {
    assert.deepEqual(shopping('Milch'), [
      { name: 'Milch', quantity: null, unit: '', estimatedCents: null },
    ]);
  });

  it('trennt mehrere Einträge an "und" und Kommas', () => {
    const items = shopping('Milch, Brot und Butter');
    assert.deepEqual(
      items.map((i) => i.name),
      ['Milch', 'Brot', 'Butter'],
    );
  });

  it('liest Menge und Einheit', () => {
    assert.deepEqual(shopping('2 Liter Milch'), [
      { name: 'Milch', quantity: 2, unit: 'l', estimatedCents: null },
    ]);
    assert.deepEqual(shopping('500 Gramm Mehl'), [
      { name: 'Mehl', quantity: 500, unit: 'g', estimatedCents: null },
    ]);
  });

  it('versteht ausgeschriebene Zahlwörter', () => {
    assert.deepEqual(shopping('drei Äpfel'), [
      { name: 'Äpfel', quantity: 3, unit: '', estimatedCents: null },
    ]);
  });

  it('liest Preise in verschiedenen Schreibweisen', () => {
    assert.equal(shopping('Milch für 1,50')[0].estimatedCents, 150);
    assert.equal(shopping('Käse für 4 Euro')[0].estimatedCents, 400);
    assert.equal(shopping('Wein 12 Euro 50')[0].estimatedCents, 1250);
    assert.equal(shopping('Brot 2,99 Euro')[0].estimatedCents, 299);
  });

  it('verwechselt eine Mengenangabe nicht mit einem Preis', () => {
    const [item] = shopping('1,5 Liter Cola');
    assert.equal(item.estimatedCents, null);
    assert.equal(item.quantity, 1.5);
    assert.equal(item.name, 'Cola');
  });

  it('kombiniert Menge, Einheit und Preis', () => {
    assert.deepEqual(shopping('2 Packungen Kaffee für 9,98'), [
      { name: 'Kaffee', quantity: 2, unit: 'Packung', estimatedCents: 998 },
    ]);
  });

  it('entfernt einleitende Floskeln', () => {
    assert.equal(shopping('ich brauche noch Zucker')[0].name, 'Zucker');
    assert.equal(shopping('bitte Tomaten besorgen')[0].name, 'Tomaten');
  });

  it('erkennt den Einkauf auch ohne Modus am Auslöser', () => {
    const result = parseUtterance('auf die Einkaufsliste: Zwiebeln', HEUTE, 'auto');
    assert.ok(result && result.kind === 'shopping');
    assert.equal(result.items[0].name, 'Zwiebeln');
  });
});

describe('Termine', () => {
  const appointment = (text: string) => {
    const result = parseUtterance(text, HEUTE, 'plan');
    assert.ok(result && result.kind === 'appointment', `nicht als Termin erkannt: ${text}`);
    return result;
  };

  it('erkennt "morgen um 15 Uhr"', () => {
    const result = appointment('morgen um 15 Uhr Zahnarzt');
    assert.equal(result.date, '2026-08-05');
    assert.equal(result.startMin, 15 * 60);
    assert.equal(result.title, 'Zahnarzt');
    assert.equal(result.durationMin, 60);
  });

  it('erkennt "übermorgen"', () => {
    assert.equal(appointment('übermorgen 9 Uhr Werkstatt').date, '2026-08-06');
  });

  it('erkennt Minuten in beiden Schreibweisen', () => {
    assert.equal(appointment('heute um 14:30 Meeting').startMin, 14 * 60 + 30);
    assert.equal(appointment('heute um 14 Uhr 30 Meeting').startMin, 14 * 60 + 30);
  });

  it('versteht "halb drei" als 14:30', () => {
    assert.equal(appointment('morgen halb drei Kaffee mit Anna').startMin, 14 * 60 + 30);
  });

  it('versteht "viertel nach acht" und "dreiviertel vier"', () => {
    assert.equal(appointment('morgen viertel nach acht Frühstück').startMin, 8 * 60 + 15);
    assert.equal(appointment('morgen dreiviertel vier Abholen').startMin, 15 * 60 + 45);
  });

  it('legt Nachmittagsstunden sinnvoll aus', () => {
    // "um 3" meint den Nachmittag, "um 9" den Vormittag.
    assert.equal(appointment('morgen um 3 Uhr Friseur').startMin, 15 * 60);
    assert.equal(appointment('morgen um 9 Uhr Arzt').startMin, 9 * 60);
  });

  it('springt bei Wochentagen nach vorn, nie auf heute', () => {
    // Bezugstag ist ein Dienstag.
    assert.equal(appointment('am Freitag um 10 Uhr Team').date, '2026-08-07');
    assert.equal(appointment('am Dienstag um 10 Uhr Team').date, '2026-08-11');
  });

  it('liest ein ausgeschriebenes Datum', () => {
    assert.equal(appointment('am 12. September um 11 Uhr Notar').date, '2026-09-12');
    assert.equal(appointment('am 12.9. um 11 Uhr Notar').date, '2026-09-12');
  });

  it('zieht ein vergangenes Datum ohne Jahr ins nächste Jahr', () => {
    assert.equal(appointment('am 3.2. um 11 Uhr Steuerberater').date, '2027-02-03');
  });

  it('übernimmt eine genannte Dauer', () => {
    assert.equal(appointment('morgen um 10 Uhr Sport für 90 Minuten').durationMin, 90);
    assert.equal(appointment('morgen um 10 Uhr Workshop für 2 Stunden').durationMin, 120);
  });

  it('nimmt ohne Datum den heutigen Tag', () => {
    assert.equal(appointment('um 17 Uhr Einkaufen gehen').date, HEUTE);
  });
});

describe('Aufgaben', () => {
  it('wird ohne Uhrzeit zur Aufgabe', () => {
    const result = parseUtterance('Rasen mähen', HEUTE, 'plan');
    assert.ok(result && result.kind === 'task');
    assert.equal(result.title, 'Rasen mähen');
    assert.equal(result.date, null);
  });

  it('behält ein genanntes Datum als Fälligkeit', () => {
    const result = parseUtterance('bis Freitag Angebot schreiben', HEUTE, 'plan');
    assert.ok(result && result.kind === 'task');
    assert.equal(result.date, '2026-08-07');
  });

  it('übernimmt eine Dauer als Schätzung', () => {
    const result = parseUtterance('Keller aufräumen 2 Stunden', HEUTE, 'plan');
    assert.ok(result && result.kind === 'task');
    assert.equal(result.estimateMin, 120);
  });
});

describe('Randfälle', () => {
  it('liefert für leere Eingaben nichts', () => {
    assert.equal(parseUtterance('', HEUTE), null);
    assert.equal(parseUtterance('   ', HEUTE, 'shopping'), null);
  });

  it('entfernt Satzzeichen am Ende', () => {
    const result = parseUtterance('Milch kaufen.', HEUTE, 'shopping');
    assert.ok(result && result.kind === 'shopping');
    assert.equal(result.items[0].name, 'Milch');
  });
});

describe('Nachgezogene Fälle aus dem Bedientest', () => {
  it('erkennt einen ausgeschriebenen Preis', () => {
    const result = parseUtterance('Brot für drei Euro', HEUTE, 'shopping');
    assert.ok(result && result.kind === 'shopping');
    assert.equal(result.items[0].estimatedCents, 300);
    assert.equal(result.items[0].name, 'Brot');
  });

  it('zerlegt einen ganzen Einkaufssatz samt Preis', () => {
    const result = parseUtterance('zwei Liter Milch und Brot für drei Euro', HEUTE, 'shopping');
    assert.ok(result && result.kind === 'shopping');
    assert.deepEqual(result.items, [
      { name: 'Milch', quantity: 2, unit: 'l', estimatedCents: null },
      { name: 'Brot', quantity: null, unit: '', estimatedCents: 300 },
    ]);
  });

  it('lässt kein "um" im Titel zurück', () => {
    for (const satz of [
      'morgen um viertel nach acht Zahnarzt',
      'morgen um halb drei Zahnarzt',
      'morgen um dreiviertel vier Zahnarzt',
    ]) {
      const result = parseUtterance(satz, HEUTE, 'plan');
      assert.ok(result && result.kind === 'appointment', satz);
      assert.equal(result.title, 'Zahnarzt', satz);
    }
  });
});

describe('Zuständigkeit aus dem Gesprochenen', () => {
  const LEUTE = [
    { id: 'l', name: 'Lukas' },
    { id: 's', name: 'Svenja' },
  ];
  const deute = (text: string) => parseUtterance(text, HEUTE, 'plan', LEUTE);

  it('erkennt eine Person am Satzende', () => {
    const result = deute('morgen um 15 Uhr Zahnarzt für Svenja');
    assert.ok(result && result.kind === 'appointment');
    assert.deepEqual(result.memberIds, ['s']);
    assert.equal(result.title, 'Zahnarzt');
  });

  it('erkennt beide Personen', () => {
    const result = deute('am Freitag um 19 Uhr Kino für Lukas und Svenja');
    assert.ok(result && result.kind === 'appointment');
    assert.deepEqual(result.memberIds, ['l', 's']);
    assert.equal(result.title, 'Kino');
  });

  it('erkennt die Zuständigkeit auch bei einer Aufgabe', () => {
    const result = deute('Rasen mähen für Lukas');
    assert.ok(result && result.kind === 'task');
    assert.deepEqual(result.memberIds, ['l']);
    assert.equal(result.title, 'Rasen mähen');
  });

  it('verwechselt eine Dauer nicht mit einem Namen', () => {
    const result = deute('am Freitag halb drei Meeting für 2 Stunden');
    assert.ok(result && result.kind === 'appointment');
    assert.deepEqual(result.memberIds, []);
    assert.equal(result.durationMin, 120);
  });

  it('lässt einen unbekannten Namen als Teil des Titels stehen', () => {
    const result = deute('Geschenk für Oma besorgen');
    assert.ok(result && result.kind === 'task');
    assert.deepEqual(result.memberIds, []);
    assert.match(result.title, /Oma/);
  });

  it('kommt ohne bekannte Personen ohne Zuordnung aus', () => {
    const result = parseUtterance('morgen um 15 Uhr Zahnarzt für Svenja', HEUTE, 'plan');
    assert.ok(result && result.kind === 'appointment');
    assert.deepEqual(result.memberIds, []);
  });
});
