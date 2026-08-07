import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  describeLead,
  describeOccurrence,
  dueNotices,
  nextOccurrence,
  occurrenceIn,
  occurrencesOn,
  upcoming,
} from './anniversaries';
import type { Anniversary } from './types';

const HEUTE = '2026-08-07';

const jahrestag = (extra: Partial<Anniversary> = {}): Anniversary => ({
  id: extra.id ?? 'a',
  title: extra.title ?? 'Mama',
  kind: extra.kind ?? 'geburtstag',
  month: extra.month ?? 8,
  day: extra.day ?? 20,
  sinceYear: extra.sinceYear === undefined ? 1966 : extra.sinceYear,
  leadDays: extra.leadDays ?? 7,
  notes: '',
  memberIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('Termin im Jahr', () => {
  it('setzt den gewöhnlichen Fall zusammen', () => {
    assert.equal(occurrenceIn(jahrestag({ month: 3, day: 4 }), 2026), '2026-03-04');
  });

  it('lässt den 29. Februar im Schaltjahr stehen', () => {
    assert.equal(occurrenceIn(jahrestag({ month: 2, day: 29 }), 2028), '2028-02-29');
  });

  it('legt ihn sonst auf den 1. März, nicht auf den 28. Februar', () => {
    // Einen Tag zu früh zu gratulieren wäre schlechter als einen Tag später.
    assert.equal(occurrenceIn(jahrestag({ month: 2, day: 29 }), 2026), '2026-03-01');
    assert.equal(occurrenceIn(jahrestag({ month: 2, day: 29 }), 2027), '2027-03-01');
  });
});

describe('Nächster Termin', () => {
  it('findet den Termin in diesem Jahr', () => {
    const next = nextOccurrence(jahrestag({ month: 8, day: 20 }), HEUTE);
    assert.equal(next.date, '2026-08-20');
    assert.equal(next.inDays, 13);
  });

  it('springt ins nächste Jahr, wenn er vorbei ist', () => {
    const next = nextOccurrence(jahrestag({ month: 3, day: 4 }), HEUTE);
    assert.equal(next.date, '2027-03-04');
  });

  it('zählt den heutigen Tag noch mit', () => {
    const next = nextOccurrence(jahrestag({ month: 8, day: 7 }), HEUTE);
    assert.equal(next.date, HEUTE);
    assert.equal(next.inDays, 0);
  });

  it('rechnet das Alter aus dem Jahrgang', () => {
    assert.equal(nextOccurrence(jahrestag({ sinceYear: 1966 }), HEUTE).ordinal, 60);
  });

  it('zählt nichts ohne Jahrgang', () => {
    assert.equal(nextOccurrence(jahrestag({ sinceYear: null }), HEUTE).ordinal, null);
  });

  it('zählt im Anfangsjahr selbst noch nicht', () => {
    // Wer 2026 geboren wird, wird 2026 nicht „null".
    const next = nextOccurrence(jahrestag({ month: 12, day: 1, sinceYear: 2026 }), HEUTE);
    assert.equal(next.ordinal, null);
  });
});

describe('Was heute ansteht', () => {
  it('nennt nur den Tag selbst', () => {
    const treffer = occurrencesOn(
      [jahrestag({ id: 'a', month: 8, day: 7 }), jahrestag({ id: 'b', month: 8, day: 8 })],
      HEUTE,
    );
    assert.deepEqual(
      treffer.map((o) => o.anniversary.id),
      ['a'],
    );
  });
});

describe('Ankündigung', () => {
  it('meldet sich, sobald der Vorlauf angebrochen ist', () => {
    const notices = dueNotices([jahrestag({ month: 8, day: 12, leadDays: 7 })], HEUTE);
    assert.equal(notices.length, 1);
    assert.equal(notices[0].inDays, 5);
  });

  it('schweigt, solange der Vorlauf noch nicht erreicht ist', () => {
    assert.deepEqual(dueNotices([jahrestag({ month: 8, day: 20, leadDays: 7 })], HEUTE), []);
  });

  it('meldet ohne Vorlauf nur am Tag selbst', () => {
    const ohne = jahrestag({ month: 8, day: 8, leadDays: 0 });
    assert.deepEqual(dueNotices([ohne], HEUTE), []);
    assert.equal(dueNotices([ohne], '2026-08-08').length, 1);
  });

  it('sortiert das Nächstliegende nach vorn', () => {
    const notices = dueNotices(
      [
        jahrestag({ id: 'spaet', title: 'Spät', month: 8, day: 14, leadDays: 30 }),
        jahrestag({ id: 'frueh', title: 'Früh', month: 8, day: 9, leadDays: 30 }),
      ],
      HEUTE,
    );
    assert.deepEqual(
      notices.map((o) => o.anniversary.id),
      ['frueh', 'spaet'],
    );
  });

  it('kündigt auch über den Jahreswechsel hinweg an', () => {
    const silvester = jahrestag({ month: 1, day: 2, leadDays: 10, sinceYear: null });
    const notices = dueNotices([silvester], '2026-12-28');
    assert.equal(notices.length, 1);
    assert.equal(notices[0].date, '2027-01-02');
    assert.equal(notices[0].inDays, 5);
  });
});

describe('Übersicht', () => {
  it('reiht die nächsten Termine nach Abstand', () => {
    const liste = upcoming(
      [
        jahrestag({ id: 'c', title: 'C', month: 3, day: 1 }),
        jahrestag({ id: 'a', title: 'A', month: 8, day: 20 }),
        jahrestag({ id: 'b', title: 'B', month: 10, day: 5 }),
      ],
      HEUTE,
    );
    assert.deepEqual(
      liste.map((o) => o.anniversary.id),
      ['a', 'b', 'c'],
    );
  });

  it('beachtet den Zeitraum', () => {
    const liste = upcoming([jahrestag({ month: 10, day: 5 })], HEUTE, 30);
    assert.deepEqual(liste, []);
  });
});

describe('Beschriftung', () => {
  it('schreibt das Alter aus', () => {
    const next = nextOccurrence(jahrestag({ title: 'Mama', sinceYear: 1966 }), HEUTE);
    assert.equal(describeOccurrence(next), 'Mama wird 60');
  });

  it('kommt ohne Jahrgang aus', () => {
    const next = nextOccurrence(jahrestag({ title: 'Oma', sinceYear: null }), HEUTE);
    assert.equal(describeOccurrence(next), 'Oma hat Geburtstag');
  });

  it('zählt Jahrestage anders', () => {
    const next = nextOccurrence(
      jahrestag({ title: 'Hochzeitstag', kind: 'jahrestag', sinceYear: 2021 }),
      HEUTE,
    );
    assert.equal(describeOccurrence(next), 'Hochzeitstag · zum 5. Mal');
  });

  it('nennt einen Jahrestag ohne Zählung beim Namen', () => {
    const next = nextOccurrence(
      jahrestag({ title: 'TÜV Golf', kind: 'jahrestag', sinceYear: null }),
      HEUTE,
    );
    assert.equal(describeOccurrence(next), 'TÜV Golf');
  });

  it('sagt den Abstand so, wie man ihn ausspricht', () => {
    assert.equal(describeLead(0), 'heute');
    assert.equal(describeLead(1), 'morgen');
    assert.equal(describeLead(2), 'übermorgen');
    assert.equal(describeLead(9), 'in 9 Tagen');
  });
});
