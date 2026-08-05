import { useState } from 'react';
import { BUNDESLAENDER, holidaysFor, type Bundesland } from '../domain/holidays';
import type { Member } from '../domain/types';
import { addMember, deleteMember, updateMember, updateSettings } from '../storage/store';

type Props = {
  members: Member[];
  bundesland: string;
};

const FARBEN = ['#2e6f63', '#a3741f', '#7c5aa6', '#b24a3c', '#3f6e8c'];

/** Personen für den Urlaubsplaner und das Bundesland für die Feiertage. */
export function MemberSettings({ members, bundesland }: Props) {
  const [name, setName] = useState('');
  const land = (bundesland in BUNDESLAENDER ? bundesland : 'NW') as Bundesland;
  const jahr = new Date().getFullYear();
  const feiertage = holidaysFor(jahr, land);

  return (
    <div className="settings-group">
      <h3>Urlaub</h3>

      <ul className="context-list">
        {members.map((member) => (
          <li key={member.id} className="context-row">
            <input
              type="color"
              value={member.color}
              onChange={(e) => updateMember(member.id, { color: e.target.value })}
              aria-label={`Farbe für ${member.name}`}
            />
            <input
              value={member.name}
              onChange={(e) => updateMember(member.id, { name: e.target.value })}
              aria-label="Name"
            />
            <label className="field narrow">
              <span>Urlaubstage</span>
              <input
                type="number"
                min={0}
                max={99}
                value={member.annualLeaveDays}
                onChange={(e) =>
                  updateMember(member.id, { annualLeaveDays: Number(e.target.value) })
                }
                aria-label="Jahresanspruch"
              />
            </label>
            <button
              className="btn tiny danger ghost"
              onClick={() => deleteMember(member.id)}
              title="Person samt ihrer Abwesenheiten entfernen"
            >
              Löschen
            </button>
          </li>
        ))}
      </ul>

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addMember(name, FARBEN[members.length % FARBEN.length], 30);
          setName('');
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Person hinzufügen"
        />
        <button className="btn" type="submit" disabled={!name.trim()}>
          Hinzufügen
        </button>
      </form>

      <label className="field">
        <span>Bundesland für die Feiertage</span>
        <select
          value={land}
          onChange={(e) => updateSettings({ bundesland: e.target.value })}
        >
          {Object.entries(BUNDESLAENDER).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <p className="hint">
        {feiertage.length} gesetzliche Feiertage in {jahr}. Sie verbrauchen keinen Urlaubstag.
        Die Berechnung läuft im Gerät, ohne Dienst von außen.
      </p>
      <p className="hint">
        Ortsabhängige Ausnahmen kennt sie nicht: Mariä Himmelfahrt gilt in Bayern nur in
        überwiegend katholischen Gemeinden, Fronleichnam zusätzlich in einzelnen Gemeinden
        Sachsens und Thüringens. Wer betroffen ist, trägt den Tag als freien Tag ein.
      </p>
    </div>
  );
}
