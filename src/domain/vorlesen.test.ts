import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inHappen, vorleseText } from './vorlesen';
import type { Vorschlag } from './assistant';

const vorschlag = (text: string, id = 'v1'): Vorschlag => ({
  id,
  werkzeug: 'termin_anlegen',
  text,
  args: {},
});

describe('Was vorgelesen wird', () => {
  it('liest die Antwort', () => {
    assert.equal(vorleseText('Am Donnerstag ist nichts.'), 'Am Donnerstag ist nichts.');
  });

  /*
   * Wer freihändig fragt, sieht nicht hin. „Ich kann zwei Sachen eintragen",
   * ohne zu sagen welche, wäre die Hälfte einer Antwort.
   */
  it('nennt die Vorschläge mit', () => {
    const t = vorleseText('Soll ich das eintragen?', [vorschlag('Termin am 11.8. um 10:00: Arzt')]);
    assert.match(t, /Termin am 11\.8\. um 10:00: Arzt/);
    assert.match(t, /Übernehmen/);
  });

  it('sagt bei mehreren Vorschlägen, dass jeder einzeln bestätigt wird', () => {
    const t = vorleseText('Beides geht.', [vorschlag('Erstens', 'a'), vorschlag('Zweitens', 'b')]);
    assert.match(t, /Erstens/);
    assert.match(t, /Zweitens/);
    assert.match(t, /jeweils/);
  });

  it('hängt ohne Vorschlag nichts an', () => {
    assert.doesNotMatch(vorleseText('Nur eine Auskunft.'), /Übernehmen/);
  });
});

describe('In sprechbare Stücke zerlegen', () => {
  it('lässt einen kurzen Text ganz', () => {
    assert.deepEqual(inHappen('Am Donnerstag ist nichts.'), ['Am Donnerstag ist nichts.']);
  });

  it('gibt für nichts auch nichts zurück', () => {
    assert.deepEqual(inHappen(''), []);
    assert.deepEqual(inHappen('   \n  '), []);
  });

  /*
   * Der Grund für das Ganze: Chrome bricht eine lange Äußerung nach etwa
   * fünfzehn Sekunden mitten im Wort ab.
   */
  it('zerlegt einen langen Text in Stücke unter der Grenze', () => {
    const lang = Array.from({ length: 12 }, (_, i) => `Das ist Satz Nummer ${i + 1}.`).join(' ');
    const happen = inHappen(lang, 80);
    assert.ok(happen.length > 1, `nur ${happen.length} Stück`);
    for (const h of happen) assert.ok(h.length <= 80, `zu lang: ${h.length}`);
  });

  it('trennt an Satzenden und behält das Satzzeichen', () => {
    const happen = inHappen('Erster Satz hier. Zweiter Satz dort. Dritter Satz da.', 25);
    for (const h of happen) assert.match(h, /[.!?]$/, h);
  });

  /* Mitten im Wort zu trennen klänge schlimmer als jeder Abbruch. */
  it('trennt einen überlangen Satz an Wortgrenzen, nie im Wort', () => {
    const satz = `Das ist ein sehr langer Satz ohne jeden Punkt ${'und noch mehr Worte '.repeat(8)}`;
    const happen = inHappen(satz, 60);
    assert.ok(happen.length > 1);
    for (const h of happen) {
      assert.ok(h.length <= 60, `zu lang: ${h.length}`);
      assert.doesNotMatch(h, /^\s|\s$/);
    }
    // Zusammengesetzt steht wieder derselbe Text da – nichts geht verloren.
    assert.equal(happen.join(' '), satz.replace(/\s+/g, ' ').trim());
  });

  it('verliert auch bei Satzzeichen nichts', () => {
    const text = 'Erstens dies. Zweitens das! Und drittens? Genau.';
    assert.equal(inHappen(text, 20).join(' '), text);
  });

  it('macht aus Zeilenumbrüchen einfache Abstände', () => {
    assert.deepEqual(inHappen('Erste Zeile.\n\nZweite Zeile.', 200), [
      'Erste Zeile. Zweite Zeile.',
    ]);
  });
});
