import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { itemPrice, referencePrice, shoppingSum, RICHTWERT_QUELLE } from './reference';

const pos = (name: string, estimatedCents: number | null = null) => ({ name, estimatedCents });

describe('Richtwert finden', () => {
  it('findet den Artikel beim Namen', () => {
    assert.equal(referencePrice('Milch')?.name, 'Milch');
    assert.equal(referencePrice('butter')?.name, 'Butter');
    assert.equal(referencePrice('  Eier  ')?.name, 'Eier');
  });

  it('lässt sich von Menge und Einheit nicht stören', () => {
    // So tippt man es wirklich ein.
    for (const eingabe of ['2 Liter Milch', '1l Milch', '500 g Milch', '2x Milch', 'Bio Milch']) {
      assert.equal(referencePrice(eingabe)?.name, 'Milch', eingabe);
    }
  });

  it('kennt weitere Schreibweisen', () => {
    assert.equal(referencePrice('Vollmilch')?.name, 'Milch');
    assert.equal(referencePrice('Klopapier')?.name, 'Toilettenpapier');
    assert.equal(referencePrice('Möhren')?.name, 'Karotten');
    assert.equal(referencePrice('Spaghetti')?.name, 'Nudeln');
  });

  it('findet das Grundwort am Ende einer Zusammensetzung', () => {
    // Im Deutschen steht es hinten.
    assert.equal(referencePrice('Kaffeesahne')?.name, 'Sahne');
    assert.equal(referencePrice('Salatgurke')?.name, 'Gurke');
    assert.equal(referencePrice('Weizenmehl')?.name, 'Mehl');
  });

  it('verwechselt Zusammensetzungen nicht mit ihrem Bestimmungswort', () => {
    /*
     * „Milchreis" ist Reis, nicht Milch – das Grundwort steht hinten. Wer
     * am Wortanfang suchte, bekäme hier den Milchpreis für ein Kilo Reis.
     */
    assert.equal(referencePrice('Milchreis')?.name, 'Reis');
    assert.equal(referencePrice('Buttermilch')?.name, 'Milch');
  });

  it('rät nicht', () => {
    // Nichts davon steht in der Tabelle – dann lieber gar nichts sagen.
    assert.equal(referencePrice('Backpulver'), null);
    assert.equal(referencePrice('Grillanzünder'), null);
    assert.equal(referencePrice(''), null);
    assert.equal(referencePrice('2 Liter'), null);
  });

  it('lässt sich nicht von kurzen Endungen täuschen', () => {
    // „Preis" endet auf „reis", „Kleie" fast auf „Eier" – beides kein Treffer.
    assert.equal(referencePrice('Preis'), null);
    assert.equal(referencePrice('Kleie'), null);
  });

  it('nennt eine Bezugsmenge zu jedem Preis', () => {
    // Ein Preis ohne Menge ist keine Auskunft: 2,29 € Butter – wofür?
    for (const name of ['Milch', 'Butter', 'Kartoffeln', 'Kaffee', 'Bier']) {
      const treffer = referencePrice(name);
      assert.ok(treffer, name);
      assert.ok(treffer.menge.length > 0, name);
      assert.ok(treffer.cents > 0, name);
    }
  });
});

describe('Welcher Preis gilt', () => {
  it('lässt dem eigenen Preis den Vortritt', () => {
    // Was ihr bezahlt habt, schlägt jede Schätzung.
    assert.deepEqual(itemPrice(pos('Milch', 89)), { cents: 89, herkunft: 'eigen' });
  });

  it('springt nur ein, wo nichts steht', () => {
    const preis = itemPrice(pos('Milch'));
    assert.equal(preis?.herkunft, 'richtwert');
    assert.equal(preis?.menge, '1 l');
  });

  it('achtet auch eine eingetragene Null', () => {
    // Null Euro ist eine Aussage („kriegen wir geschenkt"), nicht „keine Angabe".
    assert.deepEqual(itemPrice(pos('Milch', 0)), { cents: 0, herkunft: 'eigen' });
  });

  it('gibt nichts zurück, wo es nichts gibt', () => {
    assert.equal(itemPrice(pos('Grillanzünder')), null);
  });
});

describe('Summe der Liste', () => {
  it('trennt Bezahltes von Geschätztem', () => {
    const summe = shoppingSum([pos('Milch', 89), pos('Butter'), pos('Grillanzünder')]);
    assert.equal(summe.cents, 89 + 229);
    assert.equal(summe.geschaetztCents, 229);
    assert.equal(summe.ohnePreis, 1);
  });

  it('kommt mit einer leeren Liste zurecht', () => {
    assert.deepEqual(shoppingSum([]), { cents: 0, geschaetztCents: 0, ohnePreis: 0 });
  });
});

describe('Herkunft der Zahlen', () => {
  it('behauptet keine Quelle, die es nicht gibt', () => {
    /*
     * Die Tabelle sollte ursprünglich aus den Durchschnittspreisen des
     * Statistischen Bundesamtes stammen. Die ließen sich nicht abrufen.
     * Zahlen mit einer Quelle zu beschriften, aus der sie nicht stammen,
     * wäre schlimmer als gar keine Quelle – dieser Test hält das fest.
     */
    assert.match(RICHTWERT_QUELLE, /Schätzwerte/);
    assert.doesNotMatch(RICHTWERT_QUELLE, /Bundesamt|Destatis|amtlich[^e]/i);
  });
});
