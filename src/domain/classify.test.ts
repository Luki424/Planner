import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyEvent, summarizeClassification } from './classify';

describe('Privat erkennen', () => {
  it('erkennt Gesundheit, Ämter und Freizeit', () => {
    for (const titel of [
      'Zahnarzt',
      'Impfen',
      'Notar Mücke',
      'Konsulat Stuttgart',
      'Standesamt',
      'Golfclub Kirchheim',
      'Installateur',
      'Zählertausch',
      'Kruzfahrt',
      'Privater Termin',
    ]) {
      assert.equal(classifyEvent(titel), 'privat', titel);
    }
  });

  it('findet das Grundwort auch mitten in einer Zusammensetzung', () => {
    // Im Deutschen steht es hinten: Überraschungs-ausflug.
    assert.equal(classifyEvent('Überraschungsausflug'), 'privat');
    assert.equal(classifyEvent('Sommerurlaub'), 'privat');
    assert.equal(classifyEvent('Kindergeburtstag'), 'privat');
    assert.equal(classifyEvent('Zahnarzttermin Dr. Berger'), 'privat');
  });
});

describe('Beruflich erkennen', () => {
  it('erkennt die üblichen Arbeitswörter', () => {
    for (const titel of [
      'Team-Besprechung',
      'Meeting Mymoto - BVD',
      'BVD Monday Kick-Off',
      'Abstimmung Preise',
      'Jour fixe',
      'KBA Betriebsbegehung Inventur',
    ]) {
      assert.equal(classifyEvent(titel), 'beruflich', titel);
    }
  });
});

describe('Lieber nichts sagen als falsch raten', () => {
  /*
   * Alle diese Fälle kommen aus einem echten Arbeitskalender. Eine reine
   * Teilwortsuche ordnete sie privat zu – „Thomas" wegen „oma", „CoP" wegen
   * „op". Ein falsch einsortierter Termin ist schlimmer als ein nicht
   * einsortierter: man sucht ihn nicht dort, wo er liegt.
   */
  it('lässt sich nicht von Wortteilen täuschen', () => {
    assert.equal(classifyEvent('Thomas Behringer'), null);
    assert.equal(classifyEvent('CoP KBA'), null);
    assert.equal(classifyEvent('Opel Werksbesichtigung'), null);
  });

  it('hält sich bei mehrdeutigen Wörtern zurück', () => {
    // „Training" wäre im Arbeitskalender ein Verkaufstraining.
    assert.equal(classifyEvent('Verkaufstraining'), null);
    assert.equal(classifyEvent('Update PPWR'), null);
    assert.equal(classifyEvent('Termin'), null);
    assert.equal(classifyEvent('Österreich'), null);
  });

  it('gibt bei leerem Titel nichts zurück', () => {
    assert.equal(classifyEvent(''), null);
    assert.equal(classifyEvent('   '), null);
  });
});

describe('Beide Listen treffen', () => {
  it('entscheidet für privat', () => {
    // Eine Hochzeit mit dem Wort „Meeting" darin ist eher eine Hochzeit.
    assert.equal(classifyEvent('Hochzeit – Meeting mit dem Fotografen'), 'privat');
  });
});

describe('Beschreibungstext', () => {
  it('bleibt außen vor', () => {
    /*
     * Einladungen aus Outlook schleppen ganze E-Mail-Verläufe mit. Darin
     * findet sich irgendein Wort immer – die Einschätzung wäre nur Zufall.
     */
    assert.equal(classifyEvent('BVD Update', '', 'Bitte den Zahnarzt-Termin verschieben'), null);
  });

  it('wertet den Ort mit', () => {
    assert.equal(classifyEvent('Termin', 'Zahnarztpraxis Dr. Berger'), 'privat');
  });
});

describe('Vorschau', () => {
  it('zählt die drei Ausgänge', () => {
    assert.deepEqual(
      summarizeClassification([
        { title: 'Zahnarzt' },
        { title: 'Team-Besprechung' },
        { title: 'Update PPWR' },
        { title: 'Kindergeburtstag' },
      ]),
      { privat: 2, beruflich: 1, unklar: 1 },
    );
  });
});
