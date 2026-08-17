import { useState } from 'react';
import { jahrGueltig, jahrText, sortiert, standText, type BucketItem } from '../domain/bucket';
import type { Member } from '../domain/types';
import {
  addBucketItem,
  deleteBucketItem,
  toggleBucketItem,
  updateBucketItem,
} from '../storage/store';

/**
 * Die Bucketlist.
 *
 * Was hier steht, ist keine Aufgabe – siehe `domain/bucket.ts`. Für die
 * Darstellung heißt das vor allem eines: **kein Druck**. Es gibt keine
 * Fortschrittsleiste, die zu langsam wirkt, keine roten Zahlen, kein
 * „überfällig". Ein Wunschjahr, das vorbei ist, steht als „war für 2025
 * gedacht" da – eine Feststellung, kein Vorwurf.
 *
 * Und Geschafftes bleibt stehen. Bei einer Aufgabenliste ist Abhaken ein
 * Aufräumen, hier ist es der Ertrag: Die untere Hälfte der Liste ist der
 * Grund, warum man so eine Liste überhaupt führt.
 */
export function BucketView({ items, members }: { items: BucketItem[]; members: Member[] }) {
  const [titel, setTitel] = useState('');
  const [jahr, setJahr] = useState('');
  const [notiz, setNotiz] = useState('');
  const [offenId, setOffenId] = useState<string | null>(null);

  const liste = sortiert(items);
  const offene = liste.filter((i) => !i.done);
  const geschafft = liste.filter((i) => i.done);

  const anlegen = () => {
    if (!titel.trim() || !jahrGueltig(jahr)) return;
    addBucketItem({
      title: titel,
      note: notiz,
      targetYear: jahr.trim() ? Number(jahr) : null,
    });
    setTitel('');
    setJahr('');
    setNotiz('');
  };

  const zeile = (item: BucketItem) => (
    <li key={item.id} className={`bucket-row${item.done ? ' done' : ''}`}>
      <button
        className="check"
        aria-label={item.done ? 'Wieder offen' : 'Geschafft'}
        aria-pressed={item.done}
        onClick={() => toggleBucketItem(item.id)}
      />
      <button
        className="bucket-main"
        onClick={() => setOffenId(offenId === item.id ? null : item.id)}
      >
        <span className="bucket-title">{item.title}</span>
        <span className="muted small">
          {jahrText(item)}
          {item.note ? ' · Notiz' : ''}
        </span>
      </button>
      {members.length > 0 && (
        <span className="bucket-who">
          {members.map((m) => {
            const an = item.memberIds.includes(m.id);
            return (
              <button
                key={m.id}
                className={`chip tiny${an ? ' on' : ''}`}
                style={{ '--accent': m.color } as React.CSSProperties}
                aria-pressed={an}
                title={`${m.name} will das${an ? '' : ' nicht ausdrücklich'}`}
                onClick={() =>
                  updateBucketItem(item.id, {
                    memberIds: an
                      ? item.memberIds.filter((x) => x !== m.id)
                      : [...item.memberIds, m.id],
                  })
                }
              >
                <span className="dot" />
                {m.name}
              </button>
            );
          })}
        </span>
      )}
      {offenId === item.id && (
        <div className="bucket-detail">
          <label className="field">
            <span>Notiz</span>
            <textarea
              rows={2}
              value={item.note}
              placeholder="Wo, was, was es ungefähr kostet"
              onChange={(e) => updateBucketItem(item.id, { note: e.target.value })}
            />
          </label>
          <div className="button-row">
            <label className="field narrow">
              <span>Wunschjahr</span>
              <input
                type="number"
                value={item.targetYear ?? ''}
                placeholder="irgendwann"
                onChange={(e) =>
                  updateBucketItem(item.id, {
                    targetYear: e.target.value.trim() ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <span className="spacer" />
            <button className="btn danger ghost tiny" onClick={() => deleteBucketItem(item.id)}>
              Löschen
            </button>
          </div>
        </div>
      )}
    </li>
  );

  return (
    <div className="panel wide">
      <header className="panel-head">
        <h2>Bucketlist</h2>
        <span className="muted">{standText(items)}</span>
      </header>

      <p className="hint">
        Was ihr noch zusammen erleben wollt. Ohne Frist und ohne Druck – ein Eintrag darf hier Jahre
        stehen. Ein Jahr ist ein Wunsch, keine Verpflichtung.
      </p>

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          anlegen();
        }}
      >
        <label className="field">
          <span>Was?</span>
          <input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Nordlichter sehen"
            aria-label="Was wollt ihr erleben"
          />
        </label>
        <label className="field narrow">
          <span>Wunschjahr</span>
          <input
            type="number"
            value={jahr}
            onChange={(e) => setJahr(e.target.value)}
            placeholder="optional"
            aria-label="Wunschjahr"
          />
        </label>
        <button
          className="btn primary"
          type="submit"
          disabled={!titel.trim() || !jahrGueltig(jahr)}
        >
          Auf die Liste
        </button>
      </form>
      {!jahrGueltig(jahr) && <p className="hint warn">Das Jahr sieht nicht wie ein Jahr aus.</p>}

      {items.length === 0 && (
        <p className="empty">
          Noch nichts drauf. Fangt mit dem an, worüber ihr zuletzt gesagt habt: „das müssten wir mal
          machen".
        </p>
      )}

      {offene.length > 0 && <ul className="bucket-list">{offene.map(zeile)}</ul>}

      {geschafft.length > 0 && (
        <>
          {/*
            Geschafftes verschwindet nicht. Es ist der Grund, warum man so eine
            Liste führt – und nach zehn Jahren ist die untere Hälfte das, was
            man liest.
          */}
          <h3 className="bucket-trenner">Geschafft</h3>
          <ul className="bucket-list">{geschafft.map(zeile)}</ul>
        </>
      )}
    </div>
  );
}
