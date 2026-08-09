import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRASH_DAYS, TRASH_LIMIT, daysLeft, describeAge, expired, purge } from './trash';
import type { TrashEntry } from './trash';

const HEUTE = '2026-08-09';

function eintrag(id: string, deletedOn: string): TrashEntry {
  return {
    id,
    label: `Aufgabe „${id}"`,
    items: [{ collection: 'tasks', entity: { id: `e-${id}` } }],
    deletedOn,
    deletedAt: `${deletedOn}T12:00:00.000Z`,
    deletedBy: null,
  };
}

const vorTagen = (n: number) => {
  const d = new Date(`${HEUTE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

describe('Aufräumfrist', () => {
  it('behält, was jünger als die Frist ist', () => {
    assert.equal(expired(eintrag('a', vorTagen(TRASH_DAYS - 1)), HEUTE), false);
  });

  it('lässt gehen, was die Frist erreicht hat', () => {
    assert.equal(expired(eintrag('a', vorTagen(TRASH_DAYS)), HEUTE), true);
    assert.equal(expired(eintrag('a', vorTagen(TRASH_DAYS + 5)), HEUTE), true);
  });

  it('räumt Abgelaufenes aus der Liste', () => {
    const liste = [eintrag('alt', vorTagen(40)), eintrag('neu', vorTagen(2))];
    assert.deepEqual(
      purge(liste, HEUTE).map((e) => e.id),
      ['neu'],
    );
  });

  it('stellt das Neueste nach vorn', () => {
    const liste = [eintrag('mittel', vorTagen(5)), eintrag('neu', vorTagen(1)), eintrag('alt', vorTagen(20))];
    assert.deepEqual(
      purge(liste, HEUTE).map((e) => e.id),
      ['neu', 'mittel', 'alt'],
    );
  });

  it('lässt den Papierkorb nicht unbegrenzt wachsen', () => {
    /*
     * Sonst würde er im Abgleich zum zweiten Datenbestand – gerade mit
     * Belegen darin wiegt jeder Eintrag ein paar hundert Kilobyte.
     */
    const viele = Array.from({ length: TRASH_LIMIT + 20 }, (_, i) => eintrag(`e${i}`, vorTagen(1)));
    assert.equal(purge(viele, HEUTE).length, TRASH_LIMIT);
  });
});

describe('Wie alt ist das', () => {
  it('sagt es in Worten, solange es sich lohnt', () => {
    assert.equal(describeAge(eintrag('a', HEUTE), HEUTE), 'heute');
    assert.equal(describeAge(eintrag('a', vorTagen(1)), HEUTE), 'gestern');
    assert.equal(describeAge(eintrag('a', vorTagen(3)), HEUTE), 'vor 3 Tagen');
  });

  it('nennt ab einer Woche das Datum', () => {
    // „vor 23 Tagen" rechnet niemand mehr in ein Datum um.
    assert.match(describeAge(eintrag('a', vorTagen(9)), HEUTE), /\d/);
    assert.doesNotMatch(describeAge(eintrag('a', vorTagen(9)), HEUTE), /vor/);
  });

  it('sagt, wie lange es noch bleibt', () => {
    assert.equal(daysLeft(eintrag('a', HEUTE), HEUTE), TRASH_DAYS);
    assert.equal(daysLeft(eintrag('a', vorTagen(10)), HEUTE), TRASH_DAYS - 10);
    // Nie negativ – „noch −3 Tage" ist keine Auskunft.
    assert.equal(daysLeft(eintrag('a', vorTagen(99)), HEUTE), 0);
  });
});
