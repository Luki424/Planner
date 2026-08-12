import { useState } from 'react';
import {
  KIND_ICONS,
  KIND_LABELS,
  describeLead,
  describeOccurrence,
  upcoming,
} from '../domain/anniversaries';
import { formatDateShort } from '../domain/dates';
import { toggleMember } from '../domain/people';
import type { Anniversary, Member } from '../domain/types';
import { addAnniversary, deleteAnniversary, updateAnniversary } from '../storage/store';

type Props = {
  anniversaries: Anniversary[];
  members: Member[];
  today: string;
};

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/** Vorlaufzeiten, die man tatsächlich braucht: rechtzeitig für ein Geschenk. */
const VORLAUF = [0, 1, 3, 7, 14, 30];

const VORLAUF_LABELS: Record<number, string> = {
  0: 'am Tag selbst',
  1: '1 Tag vorher',
  3: '3 Tage vorher',
  7: '1 Woche vorher',
  14: '2 Wochen vorher',
  30: '1 Monat vorher',
};

/**
 * Geburtstage, Hochzeitstage und alles, was sich jährlich wiederholt.
 *
 * Bewusst getrennt von den Serien: eine Serie erzeugt Aufgaben, die man
 * abhakt. Ein Geburtstag wird nicht abgehakt, er wird angekündigt.
 */
export function AnniversarySettings({ anniversaries, members, today }: Props) {
  const [offen, setOffen] = useState(false);
  const [titel, setTitel] = useState('');
  const [art, setArt] = useState<Anniversary['kind']>('geburtstag');
  const [tag, setTag] = useState('1');
  const [monat, setMonat] = useState('1');
  const [jahr, setJahr] = useState('');
  const [vorlauf, setVorlauf] = useState(7);

  const naechste = upcoming(anniversaries, today);

  const anlegen = () => {
    if (!titel.trim()) return;
    addAnniversary({
      title: titel.trim(),
      kind: art,
      month: Number(monat),
      day: Number(tag),
      sinceYear: jahr.trim() ? Number(jahr) : null,
      leadDays: vorlauf,
      notes: '',
      memberIds: [],
    });
    setTitel('');
    setJahr('');
  };

  return (
    <div className="settings-group">
      <h3>Geburtstage und Jahrestage</h3>

      <p className="hint">
        Was sich jedes Jahr wiederholt: Geburtstage, der Hochzeitstag, der TÜV. Es wird angekündigt,
        nicht abgehakt – rechtzeitig genug, um noch etwas zu besorgen.
      </p>

      {naechste.length === 0 && <p className="empty">Noch nichts eingetragen.</p>}

      {naechste.length > 0 && (
        <ul className="anniversary-list">
          {naechste.map((o) => (
            <li key={o.anniversary.id} className="anniversary-row">
              <span className="anniversary-icon" aria-hidden="true">
                {KIND_ICONS[o.anniversary.kind]}
              </span>
              <span className="anniversary-main">
                <strong>{describeOccurrence(o)}</strong>
                {/* Der Vorlauf steht schon im Auswahlfeld daneben – nicht doppelt. */}
                <span className="muted small">
                  {formatDateShort(o.date)} · {describeLead(o.inDays)}
                </span>
              </span>
              {/*
                Kein voller MemberPicker: der bringt Beschriftung und Hinweis mit
                und sprengt die Zeile. Hier reichen die Namen zum Antippen.
              */}
              {members.length > 0 && (
                <span className="anniversary-who">
                  {members.map((member) => {
                    const an = o.anniversary.memberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        className={`chip tiny${an ? ' on' : ''}`}
                        style={{ '--accent': member.color } as React.CSSProperties}
                        aria-pressed={an}
                        title={`${member.name} betrifft es${an ? '' : ' nicht'}`}
                        onClick={() =>
                          updateAnniversary(o.anniversary.id, {
                            memberIds: toggleMember(o.anniversary.memberIds, member.id),
                          })
                        }
                      >
                        <span className="dot" />
                        {member.name}
                      </button>
                    );
                  })}
                </span>
              )}
              <select
                className="anniversary-lead"
                value={o.anniversary.leadDays}
                onChange={(e) =>
                  updateAnniversary(o.anniversary.id, { leadDays: Number(e.target.value) })
                }
                aria-label={`Vorlauf für ${o.anniversary.title}`}
              >
                {VORLAUF.map((tage) => (
                  <option key={tage} value={tage}>
                    {VORLAUF_LABELS[tage]}
                  </option>
                ))}
              </select>
              <button
                className="btn tiny danger ghost anniversary-del"
                onClick={() => deleteAnniversary(o.anniversary.id)}
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}

      {!offen && (
        <div className="button-row">
          <button className="btn" onClick={() => setOffen(true)}>
            Eintragen
          </button>
        </div>
      )}

      {offen && (
        <form
          className="anniversary-add"
          onSubmit={(e) => {
            e.preventDefault();
            anlegen();
          }}
        >
          <label className="field">
            <span>Wer oder was</span>
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Mama"
              aria-label="Wer oder was"
            />
          </label>
          {/* Nicht `narrow`: In 108 px steht „Geburts‹" statt „Geburtstag". */}
          <label className="field">
            <span>Art</span>
            <select
              value={art}
              onChange={(e) => setArt(e.target.value as Anniversary['kind'])}
              aria-label="Art"
            >
              {(Object.keys(KIND_LABELS) as Anniversary['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="field narrow">
            <span>Tag</span>
            <input
              type="number"
              min={1}
              max={31}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              aria-label="Tag"
            />
          </label>
          <label className="field">
            <span>Monat</span>
            <select value={monat} onChange={(e) => setMonat(e.target.value)} aria-label="Monat">
              {MONATE.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field narrow">
            <span>{art === 'geburtstag' ? 'Jahrgang' : 'seit'}</span>
            <input
              type="number"
              min={1900}
              max={2200}
              value={jahr}
              onChange={(e) => setJahr(e.target.value)}
              placeholder="optional"
              aria-label="Jahrgang"
            />
          </label>
          <label className="field">
            <span>Ankündigen</span>
            <select
              value={vorlauf}
              onChange={(e) => setVorlauf(Number(e.target.value))}
              aria-label="Vorlauf"
            >
              {VORLAUF.map((tage) => (
                <option key={tage} value={tage}>
                  {VORLAUF_LABELS[tage]}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button className="btn primary" type="submit" disabled={!titel.trim()}>
              Anlegen
            </button>
            <button className="btn ghost" type="button" onClick={() => setOffen(false)}>
              Fertig
            </button>
          </div>
        </form>
      )}

      <p className="hint">
        Ohne Jahrgang wird nicht mitgezählt – dann steht schlicht „hat Geburtstag" statt „wird 60".
        Ein 29. Februar wird in normalen Jahren am 1. März angekündigt.
      </p>
    </div>
  );
}
