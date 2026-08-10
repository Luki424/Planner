import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ERSATZ_VORLAUF,
  dateiname,
  terminAlsKalenderdatei,
  uebergabeNotiz,
  uebergabeText,
  type Umfeld,
} from './uebergabe';
import type { Block } from './types';

const umfeld: Umfeld = {
  contexts: [
    { id: 'c1', name: 'Privat', color: '#0f0' },
    { id: 'c2', name: 'Beruflich', color: '#00f' },
  ],
  members: [
    { id: 'm1', name: 'Lukas', color: '#f00' },
    { id: 'm2', name: 'Svenja', color: '#0ff' },
  ] as never,
  tasks: [{ id: 't1', title: 'Steuer sortieren' }] as never,
};

const block = (extra: Partial<Block> = {}): Block =>
  ({
    id: 'b1',
    date: '2026-08-11',
    startMin: 600,
    durationMin: 45,
    allDay: false,
    taskId: null,
    title: 'Zahnarzt Dr. Berger',
    notes: '',
    contextId: 'c1',
    memberIds: [],
    ...extra,
  }) as Block;

describe('Die Kalenderdatei für einen Termin', () => {
  it('enthält genau einen Termin mit Titel und Zeit', () => {
    const ics = terminAlsKalenderdatei(umfeld, block(), 15);
    assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 1);
    assert.match(ics, /SUMMARY:Zahnarzt Dr. Berger/);
    assert.match(ics, /DTSTART:20260811T100000/);
    assert.match(ics, /DTEND:20260811T104500/);
  });

  /*
   * Der eigentliche Zweck: Ohne Weckzeit legt der fremde Kalender den Termin
   * still ab, und der ganze Weg dorthin hätte sich nicht gelohnt.
   */
  it('weckt mit dem eingestellten Vorlauf', () => {
    const ics = terminAlsKalenderdatei(umfeld, block(), 30);
    assert.match(ics, /BEGIN:VALARM/);
    assert.match(ics, /TRIGGER:-PT30M/);
    assert.match(ics, /ACTION:DISPLAY/);
  });

  it('weckt auch, wenn die Erinnerungen im Planer aus sind', () => {
    const ics = terminAlsKalenderdatei(umfeld, block(), 0);
    assert.match(ics, new RegExp(`TRIGGER:-PT${ERSATZ_VORLAUF}M`));
  });

  it('gibt einen ganztägigen Termin ohne Uhrzeit hinaus', () => {
    const ics = terminAlsKalenderdatei(umfeld, block({ allDay: true, title: 'Geburtstag Oma' }), 15);
    assert.match(ics, /DTSTART;VALUE=DATE:20260811/);
    assert.doesNotMatch(ics, /DTSTART:20260811T/);
  });

  it('nimmt den Titel der Aufgabe, wenn der Block an einer hängt', () => {
    const ics = terminAlsKalenderdatei(umfeld, block({ taskId: 't1', title: '' }), 15);
    assert.match(ics, /SUMMARY:Steuer sortieren/);
  });

  /* Dieselbe Kennung: Ein zweites Übergeben legt drüben kein Doppel an. */
  it('gibt jedes Mal dieselbe Kennung mit', () => {
    const a = terminAlsKalenderdatei(umfeld, block(), 15);
    const b = terminAlsKalenderdatei(umfeld, block(), 15);
    assert.match(a, /UID:b1@tagesplaner/);
    assert.equal(a.match(/UID:.*/)?.[0], b.match(/UID:.*/)?.[0]);
  });
});

describe('Was drüben neben dem Termin steht', () => {
  it('nennt den Bereich', () => {
    assert.match(uebergabeNotiz(umfeld, block()), /Privat/);
  });

  it('nennt die Zuständigen', () => {
    assert.match(uebergabeNotiz(umfeld, block({ memberIds: ['m1', 'm2'] })), /Für: Lukas, Svenja/);
  });

  it('nimmt die Notiz mit', () => {
    assert.match(uebergabeNotiz(umfeld, block({ notes: 'Zimmer 3, zweiter Stock' })), /Zimmer 3/);
  });

  /* Wer den Eintrag in einem Jahr wiederfindet, soll ihn einordnen können. */
  it('sagt, woher der Eintrag stammt', () => {
    assert.match(uebergabeNotiz(umfeld, block()), /Tagesplaner/);
  });
});

describe('Dateiname und Ansage', () => {
  it('baut einen Namen, den man wiedererkennt', () => {
    assert.equal(dateiname(umfeld, block()), '2026-08-11-Zahnarzt-Dr-Berger.ics');
  });

  it('macht aus Umlauten etwas, das jedes Dateisystem verträgt', () => {
    assert.equal(dateiname(umfeld, block({ title: 'Zählertausch Küche' })), '2026-08-11-Zahlertausch-Kuche.ics');
  });

  it('kommt auch ohne Titel zurecht', () => {
    assert.equal(dateiname(umfeld, block({ title: '' })), '2026-08-11-Termin.ics');
  });

  it('sagt in einem Satz, worum es geht', () => {
    assert.equal(uebergabeText(umfeld, block()), 'Zahnarzt Dr. Berger – 11.8. um 10:00');
  });

  it('lässt bei ganztägigem die Uhrzeit weg', () => {
    assert.equal(uebergabeText(umfeld, block({ allDay: true })), 'Zahnarzt Dr. Berger – 11.8.');
  });
});
