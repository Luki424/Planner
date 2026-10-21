import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { abgleichen } from './abgleich';
import type { IcsEvent } from './ics';
import type { Block } from './types';

const block = (
  uid: string | undefined,
  date: string,
  title: string,
  extra: Partial<Block> = {},
): Block => ({
  id: `b-${uid ?? title}-${date}`,
  date,
  startMin: 9 * 60,
  durationMin: 60,
  taskId: null,
  title,
  contextId: 'c1',
  memberIds: [],
  ...(uid ? { icsUid: uid } : {}),
  ...extra,
});

const termin = (
  uid: string,
  date: string,
  title: string,
  extra: Partial<IcsEvent> = {},
): IcsEvent => ({
  uid,
  title,
  date,
  startMin: 10 * 60,
  durationMin: 60,
  location: '',
  description: '',
  allDay: false,
  ...extra,
});

const ZEITRAUM = { von: '2026-10-21', bis: '2026-12-02' };

describe('Abgleich mit einem vollständigen Kalender', () => {
  it('erkennt einen verschobenen Termin am gleichen Titel', () => {
    const alt = block(
      'gefahrgut-20261021t0900@outlook.bvd',
      '2026-10-21',
      'Gefahrgutversand per DPD',
    );
    const neu = termin(
      'gefahrgut-20261022t1000@outlook.bvd',
      '2026-10-22',
      'Gefahrgutversand per DPD',
    );
    const r = abgleichen([alt], [neu], ZEITRAUM);
    assert.equal(r.verschoben.length, 1);
    assert.equal(r.verschoben[0].alt.id, alt.id);
    assert.equal(r.verschoben[0].neu.uid, neu.uid);
    assert.equal(r.entfallen.length, 0);
  });

  it('erkennt einen entfallenen Termin', () => {
    const alt = block('ausschreibung-20261022t1500@outlook.bvd', '2026-10-22', 'Ausschreibung');
    const r = abgleichen(
      [alt],
      [termin('x-20261023t0900@outlook.bvd', '2026-10-23', 'Anderes')],
      ZEITRAUM,
    );
    assert.deepEqual(
      r.entfallen.map((b) => b.id),
      [alt.id],
    );
    assert.equal(r.verschoben.length, 0);
  });

  it('lässt unveränderte Termine in Ruhe', () => {
    const uid = 'kickoff-20261026t1100@outlook.bvd';
    const r = abgleichen(
      [block(uid, '2026-10-26', 'Monday-Kick-Off')],
      [termin(uid, '2026-10-26', 'Monday-Kick-Off')],
      ZEITRAUM,
    );
    assert.deepEqual(r, { verschoben: [], entfallen: [] });
  });

  it('ohne Zusage „vollständig" schließt er aus Fehlendem nichts', () => {
    // Der kurze Text mit nur den neuen Einträgen: Die Kick-Offs fehlen darin,
    // sind aber nicht entfallen.
    const r = abgleichen(
      [block('kickoff-20261026t1100@outlook.bvd', '2026-10-26', 'Monday-Kick-Off')],
      [termin('kickoff-20261130t1100@outlook.bvd', '2026-11-30', 'Monday-Kick-Off')],
      null,
    );
    assert.deepEqual(r, { verschoben: [], entfallen: [] });
  });

  it('außerhalb des Zeitraums fasst er nichts an – Vergangenes bleibt', () => {
    const r = abgleichen(
      [block('kickoff-20261019t1100@outlook.bvd', '2026-10-19', 'Monday-Kick-Off')],
      [termin('kickoff-20261026t1100@outlook.bvd', '2026-10-26', 'Monday-Kick-Off')],
      ZEITRAUM,
    );
    assert.deepEqual(r, { verschoben: [], entfallen: [] });
  });

  it('fasst eigene Termine und solche aus anderen Kalendern nicht an', () => {
    const r = abgleichen(
      [
        block(undefined, '2026-10-22', 'Zahnarzt'),
        block('geburtstag-1@familie.example', '2026-10-22', 'Geburtstag Oma'),
      ],
      [termin('x-20261023t0900@outlook.bvd', '2026-10-23', 'Anderes')],
      ZEITRAUM,
    );
    assert.deepEqual(r, { verschoben: [], entfallen: [] });
  });

  it('ein neuer Termin ersetzt höchstens einen alten, den zeitlich nächsten', () => {
    const r = abgleichen(
      [
        block('ki-20261020t1400@outlook.bvd', '2026-10-22', 'KI Austausch'),
        block('ki-20261105t1400@outlook.bvd', '2026-11-05', 'KI Austausch'),
      ],
      [termin('ki-20261029t1400@outlook.bvd', '2026-10-29', 'KI Austausch')],
      ZEITRAUM,
    );
    assert.equal(r.verschoben.length, 1);
    assert.equal(r.verschoben[0].alt.date, '2026-10-22');
    assert.deepEqual(
      r.entfallen.map((b) => b.date),
      ['2026-11-05'],
    );
  });

  it('Ganztägiges paart nur mit Ganztägigem', () => {
    const r = abgleichen(
      [block('bereitschaft-20261022@outlook.bvd', '2026-10-22', 'Bereitschaft', { allDay: true })],
      [termin('bereitschaft-20261022t0900@outlook.bvd', '2026-10-22', 'Bereitschaft')],
      ZEITRAUM,
    );
    assert.equal(r.verschoben.length, 0);
    assert.equal(r.entfallen.length, 1);
  });

  it('Groß- und Kleinschreibung und Leerzeichen am Rand zählen nicht', () => {
    const r = abgleichen(
      [block('a-20261021t0900@outlook.bvd', '2026-10-21', 'KI Austausch ')],
      [termin('a-20261029t1400@outlook.bvd', '2026-10-29', 'ki austausch')],
      ZEITRAUM,
    );
    assert.equal(r.verschoben.length, 1);
  });
});
