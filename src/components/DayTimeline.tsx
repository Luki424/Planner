import { useEffect, useRef, useState } from 'react';
import { formatDuration, formatTime } from '../domain/dates';
import { blockMemberIds } from '../domain/people';
import { allDayBlocks, blockEnd, layoutBlocks, snap, timedBlocks } from '../domain/scheduling';
import type { Block, Context, ID, Member, Settings, Task } from '../domain/types';
import { useDrag } from '../hooks/dragContext';
import { deleteBlock, toggleTask, unscheduleTask, updateBlock } from '../storage/store';
import { MemberDots } from './MemberPicker';

/*
 * Höhe einer Minute in Pixeln. Bei 1 px war eine halbe Stunde 30 px hoch –
 * zu wenig für Titel und Zeit übereinander. 1.3 gibt jedem Termin Luft,
 * ohne dass der Tag unangenehm weit scrollt.
 */
export const PX_PER_MIN = 1.3;

type Props = {
  date: string;
  today: string;
  blocks: Block[];
  tasks: Task[];
  contexts: Context[];
  members: Member[];
  activeContexts: Set<ID>;
  settings: Settings;
  onEditBlock: (block: Block) => void;
  onEditTask: (task: Task) => void;
  onNewBlockAt: (startMin: number) => void;
};

export function DayTimeline({
  date,
  today,
  blocks,
  tasks,
  contexts,
  members,
  activeContexts,
  settings,
  onEditBlock,
  onEditTask,
  onNewBlockAt,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ id: ID; startY: number; startDuration: number } | null>(null);
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  const { startDrag, state: dragState } = useDrag();

  // Die Vorschaulinie zeigt, wo der gezogene Block landen würde.
  const dropMin =
    dragState?.target?.kind === 'timeline' && dragState.target.date === date
      ? dragState.payload.kind === 'block'
        ? snap(dragState.target.startMin - dragState.payload.grabOffsetMin, settings.slotMin)
        : dragState.target.startMin
      : null;

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setNowMin(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Beim Tageswechsel dorthin scrollen, wo der Tag tatsächlich beginnt –
  // sonst blickt man morgens auf leere Stunden.
  const firstBlockStart = blocks.length ? Math.min(...blocks.map((b) => b.startMin)) : null;
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const anchor =
      firstBlockStart ?? (date === today ? nowMin : Math.max(settings.dayStartMin, 8 * 60));
    const offset = (anchor - settings.dayStartMin - 30) * PX_PER_MIN;
    container.scrollTop = Math.max(0, offset);
    // Nur beim Tageswechsel neu ausrichten, nicht bei jeder Planänderung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const totalMin = settings.dayEndMin - settings.dayStartMin;
  const hours: number[] = [];
  for (let m = Math.ceil(settings.dayStartMin / 60) * 60; m <= settings.dayEndMin; m += 60)
    hours.push(m);

  const sichtbar = blocks.filter((b) => activeContexts.has(b.contextId));
  // Ganztägiges hat keine Uhrzeit und gehört deshalb nicht auf die Achse,
  // sondern in den Streifen darüber.
  const visibleBlocks = timedBlocks(sichtbar);
  const ganztags = allDayBlocks(sichtbar);
  const layout = layoutBlocks(visibleBlocks);

  const minutesFromClientY = (clientY: number): number => {
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return settings.dayStartMin;
    const raw = settings.dayStartMin + (clientY - rect.top) / PX_PER_MIN;
    return Math.min(
      settings.dayEndMin - settings.slotMin,
      Math.max(settings.dayStartMin, snap(raw, settings.slotMin)),
    );
  };

  return (
    <div className="timeline panel">
      {ganztags.length > 0 && (
        <div className="allday-strip">
          <span className="allday-label">ganztägig</span>
          <div className="allday-items">
            {ganztags.map((block) => {
              const task = block.taskId ? tasks.find((t) => t.id === block.taskId) : undefined;
              const context = contexts.find((c) => c.id === block.contextId);
              const done = task?.status === 'done';
              return (
                <button
                  key={block.id}
                  className={`allday-item${done ? ' done' : ''}`}
                  style={{ '--accent': context?.color } as React.CSSProperties}
                  onClick={() => (task ? onEditTask(task) : onEditBlock(block))}
                  title={task ? task.title : block.title}
                >
                  <span className="allday-title">{task ? task.title : block.title}</span>
                  <MemberDots memberIds={blockMemberIds(block, tasks)} members={members} />
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="timeline-scroll" ref={scrollRef} data-autoscroll="true">
        <div
          className="timeline-content"
          ref={contentRef}
          style={{ height: totalMin * PX_PER_MIN }}
          data-drop="timeline"
          data-date={date}
          data-day-start={settings.dayStartMin}
          data-px-per-min={PX_PER_MIN}
          data-slot={settings.slotMin}
          onDoubleClick={(e) => {
            if (e.target !== e.currentTarget) return;
            onNewBlockAt(minutesFromClientY(e.clientY));
          }}
        >
          {hours.map((m) => (
            <div
              key={m}
              className="hour-line"
              style={{ top: (m - settings.dayStartMin) * PX_PER_MIN }}
            >
              <span className="hour-label">{formatTime(m)}</span>
            </div>
          ))}

          {dropMin !== null && (
            <div
              className="drop-indicator"
              style={{ top: (dropMin - settings.dayStartMin) * PX_PER_MIN }}
            >
              <span>{formatTime(dropMin)}</span>
            </div>
          )}

          {date === today && nowMin >= settings.dayStartMin && nowMin <= settings.dayEndMin && (
            <div className="now-line" style={{ top: (nowMin - settings.dayStartMin) * PX_PER_MIN }}>
              <span>{formatTime(nowMin)}</span>
            </div>
          )}

          {visibleBlocks.map((block) => {
            const task = block.taskId ? tasks.find((t) => t.id === block.taskId) : undefined;
            const context = contexts.find((c) => c.id === block.contextId);
            const place = layout.get(block.id) ?? { column: 0, columns: 1 };
            const done = task?.status === 'done';
            const width = 100 / place.columns;
            // Unter dieser Höhe passen Titel und Zeitangabe nicht übereinander;
            // dann zählt der Titel, die Zeit steht ohnehin an der Achse.
            const short = block.durationMin * PX_PER_MIN < 46;
            /*
             * Wie eng es wird, entscheidet sich hier – ob es etwas bedeutet,
             * entscheidet das Stylesheet.
             *
             * Nachgemessen auf einem Pixel 7: Bei zwei gleichzeitigen Terminen
             * bleiben dem Titel 106 px, bei dreien 54 px, bei vieren 28 px.
             * „Team-Besprechung" braucht 161 px. Am Rechner ist selbst bei vier
             * Spalten noch alles lesbar, deshalb hängen die Folgen an einer
             * Bildschirmbreite und nicht an der Spaltenzahl allein.
             */
            const eng = place.columns >= 2;
            const sehrEng = place.columns >= 3;
            /*
             * Wie viele Zeilen Titel der Block hergibt.
             *
             * Eine feste Zahl wäre geraten: Ein Termin von einer Stunde hat
             * Platz für zwei Zeilen, einer von zweien für fünf. Mit einer
             * festen Zwei bliebe die längere Besprechung abgeschnitten,
             * obwohl darunter leerer Block steht.
             *
             * Gerechnet wird mit dem, was übrig bleibt: 10 px Innenabstand,
             * 16 px für die Zeitzeile, solange sie gezeigt wird, und 18 px je
             * Zeile (15 px Schrift mal 1,2 Zeilenabstand).
             */
            const hoehe = Math.max(block.durationMin * PX_PER_MIN, 26);
            const zeilen = Math.max(1, Math.floor((hoehe - 10 - (short ? 0 : 16)) / 18));
            return (
              <article
                key={block.id}
                className={`block${done ? ' done' : ''}${task ? '' : ' fixed'}${short ? ' short' : ''}${eng ? ' eng' : ''}${sehrEng ? ' sehr-eng' : ''}${
                  dragState?.payload.kind === 'block' && dragState.payload.blockId === block.id
                    ? ' dragging'
                    : ''
                }`}
                style={
                  {
                    top: (block.startMin - settings.dayStartMin) * PX_PER_MIN,
                    height: hoehe,
                    left: `calc(${place.column * width}% + 3px)`,
                    width: `calc(${width}% - 6px)`,
                    '--accent': context?.color,
                    '--titel-zeilen': zeilen,
                  } as React.CSSProperties
                }
              >
                <span
                  className="grip block-grip"
                  aria-hidden
                  title="Ziehen, um zu verschieben"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    const rect = (
                      e.currentTarget.parentElement as HTMLElement
                    ).getBoundingClientRect();
                    startDrag(
                      {
                        kind: 'block',
                        blockId: block.id,
                        label: task ? task.title : block.title,
                        durationMin: block.durationMin,
                        grabOffsetMin: (e.clientY - rect.top) / PX_PER_MIN,
                      },
                      e,
                    );
                  }}
                />
                <div className="block-head">
                  {task && (
                    <button
                      className="check"
                      aria-label="Erledigt"
                      onClick={() => toggleTask(task.id)}
                    />
                  )}
                  <button
                    className="block-title"
                    onClick={() => (task ? onEditTask(task) : onEditBlock(block))}
                  >
                    {task ? task.title : block.title}
                  </button>
                  <MemberDots
                    memberIds={blockMemberIds(block, tasks)}
                    members={members}
                    withInitials
                  />
                </div>
                {/*
                  Zwei Fassungen derselben Angabe. In einem 99 px breiten Block
                  brach „09:00–10:00 · 1 h" auf drei Zeilen um und war damit
                  56 px hoch – in einem Block von 78 px Höhe. Die kurze Fassung
                  nennt nur den Anfang; das Ende ergibt sich aus der Achse.
                  Welche gezeigt wird, hängt an der Bildschirmbreite, und die
                  kennt nur das Stylesheet.
                */}
                <div className="block-meta">
                  <span className="block-meta-lang">
                    {formatTime(block.startMin)}–{formatTime(blockEnd(block))} ·{' '}
                    {formatDuration(block.durationMin)}
                  </span>
                  <span className="block-meta-kurz">ab {formatTime(block.startMin)}</span>
                </div>
                <div className="block-actions">
                  {task ? (
                    <button title="Zurück in den Pool" onClick={() => unscheduleTask(task.id)}>
                      ↩
                    </button>
                  ) : (
                    <button title="Termin löschen" onClick={() => deleteBlock(block.id)}>
                      ×
                    </button>
                  )}
                </div>
                <div
                  className="resize-handle"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    resizeRef.current = {
                      id: block.id,
                      startY: e.clientY,
                      startDuration: block.durationMin,
                    };
                  }}
                  onPointerMove={(e) => {
                    const active = resizeRef.current;
                    if (!active) return;
                    const delta = (e.clientY - active.startY) / PX_PER_MIN;
                    const next = Math.max(
                      settings.slotMin,
                      snap(active.startDuration + delta, settings.slotMin),
                    );
                    updateBlock(active.id, { durationMin: next });
                  }}
                  onPointerUp={(e) => {
                    resizeRef.current = null;
                    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                  }}
                />
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
