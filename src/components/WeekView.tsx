import {
  WEEKDAY_SHORT,
  formatDateShort,
  formatDuration,
  formatTime,
  weekDates,
  weekdayIndex,
} from '../domain/dates';
import { KIND_ICONS, describeOccurrence, occurrencesOn } from '../domain/anniversaries';
import { absencesOn } from '../domain/leave';
import { blockMemberIds, minutesPerMember } from '../domain/people';
import { blockEnd, plannedMinutes } from '../domain/scheduling';
import type { AppState, Block, ID, Task } from '../domain/types';
import { dragHandleProps, useDrag } from '../hooks/dragContext';
import { toggleTask } from '../storage/store';
import { MemberDots } from './MemberPicker';

type Props = {
  state: AppState;
  /** Bereits nach Bereich und Person gefiltert – die Ansicht filtert nicht selbst. */
  blocks: Block[];
  anchorDate: string;
  today: string;
  activeContexts: Set<ID>;
  /** Feiertage des angezeigten Zeitraums, Datum → Name. */
  holidays: Map<string, string>;
  onOpenDay: (date: string) => void;
  onEditTask: (task: Task) => void;
  onEditBlock: (block: Block) => void;
};

export function WeekView({
  state,
  blocks,
  anchorDate,
  today,
  activeContexts,
  holidays,
  onOpenDay,
  onEditTask,
  onEditBlock,
}: Props) {
  const { startDrag, state: dragState } = useDrag();
  const days = weekDates(anchorDate);
  const dragOverDate = dragState?.target?.kind === 'day' ? dragState.target.date : null;

  return (
    <div className="week">
      {days.map((date) => {
        const dayBlocks = blocks
          .filter((b) => b.date === date && activeContexts.has(b.contextId))
          .sort((a, b) => a.startMin - b.startMin);
        const planned = plannedMinutes(dayBlocks);
        const load = Math.min(100, Math.round((planned / state.settings.capacityMin) * 100));
        const isToday = date === today;
        const isWeekend = weekdayIndex(date) >= 5;
        const holiday = holidays.get(date);
        const away = absencesOn(state.absences, date);
        const feiern = occurrencesOn(state.anniversaries, date);
        // Wie viel steht bei wem an? Erst das beantwortet die Frage, wegen der
        // ein Paar gemeinsam plant – die Gesamtsumme allein tut es nicht.
        const proPerson = minutesPerMember(dayBlocks, state.tasks);

        return (
          <section
            key={date}
            className={[
              'week-day panel',
              isToday ? 'is-today' : '',
              isWeekend ? 'is-weekend' : '',
              dragOverDate === date ? 'drag-over' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-drop="day"
            data-date={date}
          >
            <header className="week-day-head">
              <button className="link strong" onClick={() => onOpenDay(date)}>
                {WEEKDAY_SHORT[weekdayIndex(date)]} {formatDateShort(date)}
              </button>
              <span className="muted small">{planned > 0 ? formatDuration(planned) : '–'}</span>
            </header>

            {(holiday || away.length > 0 || feiern.length > 0) && (
              <div className="week-away">
                {holiday && <span className="notice-tag holiday small">{holiday}</span>}
                {feiern.map((o) => (
                  <span
                    key={o.anniversary.id}
                    className="notice-tag anniversary small"
                    title={describeOccurrence(o)}
                  >
                    <span aria-hidden="true">{KIND_ICONS[o.anniversary.kind]}</span>
                    {o.anniversary.title}
                  </span>
                ))}
                {away.map((absence) => {
                  const member = state.members.find((m) => m.id === absence.memberId);
                  return (
                    <span
                      key={absence.id}
                      className="notice-tag small"
                      style={{ '--accent': member?.color } as React.CSSProperties}
                      title={`${member?.name}: ${absence.kind}`}
                    >
                      <span className="dot" />
                      {member?.name}
                    </span>
                  );
                })}
              </div>
            )}

            {state.members.length > 0 && proPerson.size > 0 ? (
              <div className="member-loads">
                {state.members.map((member) => {
                  const minuten = proPerson.get(member.id) ?? 0;
                  const anteil = Math.min(
                    100,
                    Math.round((minuten / state.settings.capacityMin) * 100),
                  );
                  return (
                    <div
                      key={member.id}
                      className="member-load"
                      style={{ '--accent': member.color } as React.CSSProperties}
                      title={`${member.name}: ${formatDuration(minuten)} verplant`}
                    >
                      <span className="member-load-name">{member.name}</span>
                      <div className="load-bar">
                        <div
                          className={`load-fill${minuten > state.settings.capacityMin ? ' over' : ''}`}
                          style={{ width: `${anteil}%`, background: member.color }}
                        />
                      </div>
                      <span className="member-load-value">
                        {minuten > 0 ? formatDuration(minuten) : '–'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="load-bar" title={`${load}% der Tageskapazität verplant`}>
                <div
                  className={`load-fill${planned > state.settings.capacityMin ? ' over' : ''}`}
                  style={{ width: `${load}%` }}
                />
              </div>
            )}

            <ul className="week-blocks">
              {dayBlocks.map((block) => {
                const task = block.taskId
                  ? state.tasks.find((t) => t.id === block.taskId)
                  : undefined;
                const context = state.contexts.find((c) => c.id === block.contextId);
                return (
                  <li
                    key={block.id}
                    className={`week-block${task?.status === 'done' ? ' done' : ''}${
                      dragState?.payload.kind === 'block' && dragState.payload.blockId === block.id
                        ? ' dragging'
                        : ''
                    }`}
                    style={{ '--accent': context?.color } as React.CSSProperties}
                  >
                    <span
                      {...dragHandleProps(startDrag, {
                        kind: 'block',
                        blockId: block.id,
                        label: task ? task.title : block.title,
                        durationMin: block.durationMin,
                        grabOffsetMin: 0,
                      })}
                      title="Ziehen, um den Tag zu wechseln"
                    />
                    {task && (
                      <button
                        className="check"
                        aria-label="Erledigt"
                        onClick={() => toggleTask(task.id)}
                      />
                    )}
                    <button
                      className="week-block-main"
                      title={`${formatTime(block.startMin)}–${formatTime(blockEnd(block))} · ${
                        task ? task.title : block.title
                      }`}
                      onClick={() => (task ? onEditTask(task) : onEditBlock(block))}
                    >
                      {/*
                        Das Kürzel steht neben der Uhrzeit statt neben dem
                        Titel: sonst bräche in einer Wochenspalte schon
                        "Zahnarzt" mitten im Wort. Auf dem Schreibtisch, wo
                        sieben Spalten nebeneinander stehen, weicht dafür die
                        Endzeit – am Handy ist die Karte breit genug für beides.
                      */}
                      <span className="week-block-time">
                        {formatTime(block.startMin)}
                        <span className="week-block-end">–{formatTime(blockEnd(block))}</span>
                        <MemberDots
                          memberIds={blockMemberIds(block, state.tasks)}
                          members={state.members}
                          withInitials
                        />
                      </span>
                      <span className="week-block-title">{task ? task.title : block.title}</span>
                    </button>
                  </li>
                );
              })}
              {dayBlocks.length === 0 && <li className="week-empty">frei</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
