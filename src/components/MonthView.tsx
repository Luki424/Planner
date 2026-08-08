import { Fragment } from 'react';
import { KIND_ICONS, occurrencesOn } from '../domain/anniversaries';
import {
  WEEKDAY_SHORT,
  formatDuration,
  formatTime,
  isoWeekNumber,
  weekdayIndex,
} from '../domain/dates';
import { absencesOn } from '../domain/leave';
import { isSameMonth, monthGrid } from '../domain/month';
import { allDayBlocks, plannedMinutes, timedBlocks } from '../domain/scheduling';
import type { AppState, Block, ID } from '../domain/types';
import { MemberDots } from './MemberPicker';

type Props = {
  state: AppState;
  /** Bereits nach Bereich und Person gefiltert – die Ansicht filtert nicht selbst. */
  blocks: Block[];
  anchorDate: string;
  today: string;
  activeContexts: Set<ID>;
  holidays: Map<string, string>;
  /** Auf wie viele Einträge ein Feld gekürzt wird; am Handy weniger. */
  maxPerDay: number;
  onOpenDay: (date: string) => void;
  /** Sprung in die Wochenansicht – über die Kalenderwoche am Zeilenanfang. */
  onOpenWeek: (date: string) => void;
};

/**
 * Der Monat auf einem Blatt.
 *
 * Die Wochenansicht beantwortet „was steht diese Woche an", der Monat
 * beantwortet „wann haben wir mal nichts vor". Deshalb steht hier die Dichte
 * im Vordergrund: ein Balken je Tag, darunter so viel Text, wie das Feld
 * hergibt. Wer mehr wissen will, tippt den Tag an.
 */
export function MonthView({
  state,
  blocks,
  anchorDate,
  today,
  activeContexts,
  holidays,
  maxPerDay,
  onOpenDay,
  onOpenWeek,
}: Props) {
  const wochen = monthGrid(anchorDate);

  return (
    <div className="month">
      <div className="month-head" aria-hidden="true">
        {/*
          Leerstelle über der Spalte mit den Kalenderwochen – sie trägt keine
          Überschrift, weil „KW" in jeder Zelle darunter schon steht.
        */}
        <span className="month-head-cell month-week-head" />
        {WEEKDAY_SHORT.map((tag) => (
          <span key={tag} className="month-head-cell">
            {tag}
          </span>
        ))}
      </div>

      <div className="month-grid">
        {/*
          Je Zeile erst die Kalenderwoche, dann ihre sieben Tage – dieselbe
          Reihenfolge, in der das Raster sie setzt.
        */}
        {wochen.map((woche) => (
          <Fragment key={woche[0]}>
            <Woche tage={woche} onOpenWeek={onOpenWeek} />
            {woche.map((date) => {
              const desTages = blocks.filter(
                (b) => b.date === date && activeContexts.has(b.contextId),
              );
              const zeitlich = timedBlocks(desTages).sort((a, b) => a.startMin - b.startMin);
              const ganztags = allDayBlocks(desTages);
              const planned = plannedMinutes(desTages);
              const load = Math.min(100, Math.round((planned / state.settings.capacityMin) * 100));

              const feiertag = holidays.get(date);
              const feiern = occurrencesOn(state.anniversaries, date);
              const abwesend = absencesOn(state.absences, date);

              const eintraege = [...ganztags, ...zeitlich];
              const gezeigt = eintraege.slice(0, maxPerDay);
              const weitere = eintraege.length - gezeigt.length;

              const fremd = !isSameMonth(date, anchorDate);

              return (
                <button
                  key={date}
                  type="button"
                  className={[
                    'month-day',
                    fremd ? 'is-other' : '',
                    date === today ? 'is-today' : '',
                    weekdayIndex(date) >= 5 ? 'is-weekend' : '',
                    feiertag ? 'is-holiday' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onOpenDay(date)}
                  title={[
                    feiertag,
                    planned > 0 ? `${formatDuration(planned)} verplant` : 'nichts geplant',
                    ...feiern.map((o) => o.anniversary.title),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  <span className="month-day-head">
                    <span className="month-day-number">{Number(date.slice(8, 10))}</span>
                    {feiern.length > 0 && (
                      <span className="month-day-mark" aria-hidden="true">
                        {feiern.map((o) => KIND_ICONS[o.anniversary.kind]).join('')}
                      </span>
                    )}
                    {abwesend.length > 0 && (
                      <MemberDots
                        memberIds={abwesend.map((a) => a.memberId)}
                        members={state.members}
                      />
                    )}
                  </span>

                  {feiertag && <span className="month-holiday">{feiertag}</span>}

                  <span className="month-day-items">
                    {gezeigt.map((block) => {
                      const task = block.taskId
                        ? state.tasks.find((t) => t.id === block.taskId)
                        : undefined;
                      const context = state.contexts.find((c) => c.id === block.contextId);
                      return (
                        <span
                          key={block.id}
                          className={`month-item${task?.status === 'done' ? ' done' : ''}${
                            block.allDay ? ' allday' : ''
                          }`}
                          style={{ '--accent': context?.color } as React.CSSProperties}
                        >
                          {!block.allDay && (
                            <span className="month-item-time">{formatTime(block.startMin)}</span>
                          )}
                          <span className="month-item-title">
                            {task ? task.title : block.title}
                          </span>
                        </span>
                      );
                    })}
                    {weitere > 0 && <span className="month-more">+{weitere}</span>}
                  </span>

                  {planned > 0 && (
                    <span className="load-bar month-load">
                      <span
                        className={`load-fill${planned > state.settings.capacityMin ? ' over' : ''}`}
                        style={{ width: `${load}%` }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Der Kalenderwochen-Streifen am Zeilenanfang.
 *
 * Steht als eigene Zelle im selben Raster – ein Anklicken öffnet die Woche.
 * Ohne diese Spalte lässt sich ein Termin im Monat nicht einordnen, sobald
 * jemand von „KW 34" spricht, und das tut ein Arbeitskalender ständig.
 */
function Woche({ tage, onOpenWeek }: { tage: string[]; onOpenWeek: (date: string) => void }) {
  return (
    <button
      type="button"
      className="month-week"
      onClick={() => onOpenWeek(tage[0])}
      title={`Kalenderwoche ${isoWeekNumber(tage[0])} öffnen`}
    >
      {isoWeekNumber(tage[0])}
    </button>
  );
}
