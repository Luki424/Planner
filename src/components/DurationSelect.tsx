/**
 * Dauer wählen – oder „ganztägig".
 *
 * An vier Stellen dieselbe Auswahl: Pool, Aufgabendialog, Seriendialog und
 * Sprachaufnahme. Als eigener Baustein, damit „ganztägig" überall gleich
 * heißt und gleich funktioniert.
 *
 * Nach außen bleibt es sauber getrennt: der Sonderwert existiert nur im
 * Auswahlfeld, herausgereicht wird ein Flag neben der Zahl.
 */

const GANZTAGS = 'ganztags';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240];

type Props = {
  estimateMin: number;
  allDay: boolean;
  onChange: (next: { estimateMin: number; allDay: boolean }) => void;
  options?: number[];
  /** Kurzform „30m" für enge Stellen wie den Pool. */
  compact?: boolean;
  ariaLabel?: string;
};

function label(min: number, compact: boolean): string {
  if (min < 60) return compact ? `${min}m` : `${min} min`;
  const h = min / 60;
  const text = Number.isInteger(h) ? `${h}` : h.toFixed(1).replace('.', ',');
  return compact ? `${text}h` : `${text} h`;
}

export function DurationSelect({
  estimateMin,
  allDay,
  onChange,
  options = DURATION_OPTIONS,
  compact = false,
  ariaLabel = 'Dauer',
}: Props) {
  return (
    <select
      value={allDay ? GANZTAGS : estimateMin}
      aria-label={ariaLabel}
      onChange={(e) =>
        onChange(
          e.target.value === GANZTAGS
            ? // Die bisherige Schätzung bleibt stehen: schaltet jemand zurück,
              // steht wieder da, was vorher gewählt war.
              { estimateMin, allDay: true }
            : { estimateMin: Number(e.target.value), allDay: false },
        )
      }
    >
      {options.map((d) => (
        <option key={d} value={d}>
          {label(d, compact)}
        </option>
      ))}
      <option value={GANZTAGS}>ganztägig</option>
    </select>
  );
}
