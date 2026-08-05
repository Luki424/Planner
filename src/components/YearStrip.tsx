import { addDays, toISODate, weekdayIndex } from '../domain/dates';
import { isWeekend } from '../domain/leave';
import type { Absence, Member } from '../domain/types';

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

type Props = {
  year: number;
  members: Member[];
  absences: Absence[];
  holidays: Map<string, string>;
  today: string;
  onPickDay: (date: string) => void;
};

/**
 * Jahresübersicht: je Monat eine Zeile, darin ein Feld pro Tag und Person.
 *
 * So steht das ganze Jahr auf einem Blatt, und die eigentliche Frage – wann
 * haben wir gleichzeitig frei – lässt sich sehen statt ausrechnen.
 */
export function YearStrip({ year, members, absences, holidays, today, onPickDay }: Props) {
  return (
    <div className="year-strip" role="table" aria-label={`Jahresübersicht ${year}`}>
      {MONATE.map((label, monthIndex) => {
        const first = new Date(year, monthIndex, 1);
        const days = new Date(year, monthIndex + 1, 0).getDate();

        return (
          <div className="year-month" key={label} role="row">
            <span className="year-month-name">{label}</span>
            <div className="year-days">
              {Array.from({ length: days }, (_, i) => {
                const date = addDays(toISODate(first), i);
                const holiday = holidays.get(date);
                const weekend = isWeekend(date);
                const onDay = members.map((member) =>
                  absences.find(
                    (a) =>
                      a.memberId === member.id && a.startDate <= date && date <= a.endDate,
                  ),
                );
                const belegt = onDay.filter(Boolean).length;
                const titel = [
                  `${String(i + 1).padStart(2, '0')}.${String(monthIndex + 1).padStart(2, '0')}.`,
                  holiday,
                  ...members
                    .map((m, idx) => (onDay[idx] ? `${m.name}: ${onDay[idx]?.kind}` : null))
                    .filter(Boolean),
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <button
                    key={date}
                    type="button"
                    className={[
                      'year-day',
                      weekend ? 'weekend' : '',
                      holiday ? 'holiday' : '',
                      date === today ? 'is-today' : '',
                      belegt === members.length && belegt > 0 ? 'both' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={titel}
                    aria-label={titel}
                    onClick={() => onPickDay(date)}
                  >
                    {/* Je Person ein schmaler Streifen – übereinander gestapelt. */}
                    {members.map((member, idx) => (
                      <span
                        key={member.id}
                        className={`year-slice${onDay[idx] ? ' filled' : ''}${
                          onDay[idx] && onDay[idx]?.kind !== 'urlaub' ? ' other-kind' : ''
                        }`}
                        style={{ '--accent': member.color } as React.CSSProperties}
                      />
                    ))}
                    {weekdayIndex(date) === 0 && <span className="week-tick" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
