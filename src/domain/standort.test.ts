import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BEWEGUNG_M,
  abstandM,
  alterMin,
  alterText,
  genauigkeitText,
  istFrisch,
  kartenLink,
  lohntEintrag,
  ortungsFehler,
  type Standort,
} from './standort';

const JETZT = new Date('2026-08-10T12:00:00Z');

const ort = (patch: Partial<Standort> = {}): Standort => ({
  id: 's1',
  memberId: 'm1',
  lat: 51.9607,
  lon: 7.6261,
  accuracyM: 25,
  at: '2026-08-10T11:55:00Z',
  manual: false,
  ...patch,
});

describe('Wie alt der Stand ist', () => {
  it('rechnet Minuten aus', () => {
    assert.equal(alterMin('2026-08-10T11:45:00Z', JETZT), 15);
  });

  /* Eine Uhr, die vorgeht, ist kein Grund, negative Zeiten anzuzeigen. */
  it('macht aus Zukunft keine negative Zeit', () => {
    assert.equal(alterMin('2026-08-10T12:30:00Z', JETZT), 0);
  });

  it('kommt mit Unsinn zurecht', () => {
    assert.equal(alterMin('keine Zeit', JETZT), Number.POSITIVE_INFINITY);
    assert.equal(alterText(alterMin('keine Zeit', JETZT)), 'Zeit unbekannt');
  });
});

describe('Das Alter in Worten', () => {
  /*
   * Die wichtigste Angabe überhaupt: Ein Punkt auf der Karte ohne Zeit wird
   * für „jetzt" gehalten – und genau daran scheitern solche Anzeigen.
   */
  it('beugt richtig', () => {
    assert.equal(alterText(0), 'gerade eben');
    assert.equal(alterText(1), 'vor einer Minute');
    assert.equal(alterText(7), 'vor 7 Minuten');
    assert.equal(alterText(60), 'vor einer Stunde');
    assert.equal(alterText(180), 'vor 3 Stunden');
    assert.equal(alterText(60 * 24), 'vor einem Tag');
    assert.equal(alterText(60 * 24 * 3), 'vor 3 Tagen');
  });

  it('trennt frisch von alt', () => {
    assert.equal(istFrisch(5), true);
    assert.equal(istFrisch(15), true);
    assert.equal(istFrisch(16), false);
  });
});

describe('Abstand und ob sich ein Eintrag lohnt', () => {
  it('rechnet einen bekannten Abstand richtig', () => {
    // Münster → Osnabrück, rund 44 km Luftlinie.
    const km = abstandM({ lat: 51.9607, lon: 7.6261 }, { lat: 52.2799, lon: 8.0472 }) / 1000;
    assert.ok(km > 42 && km < 46, `${km.toFixed(1)} km`);
  });

  it('ist bei identischen Punkten null', () => {
    assert.equal(Math.round(abstandM({ lat: 51.96, lon: 7.62 }, { lat: 51.96, lon: 7.62 })), 0);
  });

  it('meldet den ersten Stand immer', () => {
    assert.equal(lohntEintrag(null, { lat: 51.96, lon: 7.62 }, JETZT), true);
  });

  /*
   * Ohne diese Bremse stünde bei jedem GPS-Zucken ein neuer Stand in der
   * Datenbank – Datenverkehr und Akku für nichts.
   */
  it('meldet ein kleines Zucken nicht', () => {
    const alt = ort({ at: '2026-08-10T11:58:00Z' });
    assert.equal(lohntEintrag(alt, { lat: 51.9608, lon: 7.6262 }, JETZT), false);
  });

  it('meldet eine echte Bewegung', () => {
    const alt = ort({ at: '2026-08-10T11:58:00Z' });
    // Rund 200 m nach Norden.
    assert.equal(lohntEintrag(alt, { lat: 51.9625, lon: 7.6261 }, JETZT), true);
    assert.ok(abstandM(alt, { lat: 51.9625, lon: 7.6261 }) > BEWEGUNG_M);
  });

  it('frischt auch ohne Bewegung nach einer Weile auf', () => {
    const alt = ort({ at: '2026-08-10T11:30:00Z' });
    assert.equal(lohntEintrag(alt, { lat: alt.lat, lon: alt.lon }, JETZT), true);
  });
});

describe('Anzeige', () => {
  it('baut einen Kartenlink mit sinnvoller Genauigkeit', () => {
    const link = kartenLink(51.96072345678, 7.62613456789);
    assert.match(link, /^https:\/\/www\.google\.com\/maps\?q=51\.960723,7\.626135$/);
  });

  it('sagt die Genauigkeit in Metern und Kilometern', () => {
    assert.equal(genauigkeitText(28.4), 'auf 28 m genau');
    assert.equal(genauigkeitText(2400), 'auf 2.4 km genau');
    assert.equal(genauigkeitText(0), '');
  });
});

describe('Warum die Ortung nicht ging', () => {
  /* Die Codes heißen 1, 2 und 3. Wer sie sieht, weiß nichts. */
  it('erklärt die Ablehnung und wo man sie ändert', () => {
    const text = ortungsFehler(1);
    assert.match(text, /abgelehnt/);
    assert.match(text, /Einstellungen des Browsers/);
  });

  it('erklärt die übrigen Fälle', () => {
    assert.match(ortungsFehler(2), /Drinnen/);
    assert.match(ortungsFehler(3), /zu lange/);
    assert.match(ortungsFehler(99), /nicht geklappt/);
  });
});
