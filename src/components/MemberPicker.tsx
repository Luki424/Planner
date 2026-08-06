import { initialOf, knownMembers, toggleMember } from '../domain/people';
import type { ID, Member } from '../domain/types';

type PickerProps = {
  members: Member[];
  value: ID[];
  onChange: (next: ID[]) => void;
  label?: string;
  /**
   * Was eine leere Auswahl bedeutet. Bei Aufgaben "noch offen", bei
   * Ausgaben "gemeinsam getragen" – dasselbe Feld, andere Aussage.
   */
  emptyHint?: string;
};

/**
 * Auswahl der Zuständigen. Mehrfachauswahl, weil vieles im Haushalt beide
 * betrifft. Nichts ausgewählt heißt "noch offen" – der Hinweis sagt das,
 * damit die leere Auswahl nicht wie ein vergessenes Pflichtfeld wirkt.
 */
export function MemberPicker({
  members,
  value,
  onChange,
  label = 'Wer',
  emptyHint = 'Ohne Zuordnung – gilt als noch offen.',
}: PickerProps) {
  if (members.length === 0) return null;
  return (
    <div className="field">
      <span>{label}</span>
      <div className="filters">
        {members.map((member) => {
          const on = value.includes(member.id);
          return (
            <button
              key={member.id}
              type="button"
              className={`chip${on ? ' on' : ''}`}
              style={{ '--accent': member.color } as React.CSSProperties}
              aria-pressed={on}
              onClick={() => onChange(toggleMember(value, member.id))}
            >
              <span className="dot" />
              {member.name}
            </button>
          );
        })}
      </div>
      {value.length === 0 && <p className="hint">{emptyHint}</p>}
    </div>
  );
}

type DotsProps = {
  memberIds: ID[];
  members: Member[];
  /** Kürzel statt reiner Punkte – im Gedränge der Wochenspalten hilfreich. */
  withInitials?: boolean;
};

/** Farbige Kürzel der Zuständigen. Ohne Zuordnung wird nichts gezeigt. */
export function MemberDots({ memberIds, members, withInitials = false }: DotsProps) {
  const beteiligt = knownMembers(memberIds, members);
  if (beteiligt.length === 0) return null;
  return (
    <span className="member-dots">
      {beteiligt.map((member) => (
        <span
          key={member.id}
          className={`member-dot${withInitials ? ' lettered' : ''}`}
          style={{ '--accent': member.color } as React.CSSProperties}
          title={member.name}
        >
          {withInitials ? initialOf(member) : ''}
        </span>
      ))}
    </span>
  );
}
