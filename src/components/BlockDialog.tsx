import { useState } from 'react';
import { formatTime, parseTime } from '../domain/dates';
import { memberIdsOf } from '../domain/people';
import type { Block, Context, Member, Task } from '../domain/types';
import { addFixedBlock, deleteBlock, updateBlock } from '../storage/store';
import { MemberPicker } from './MemberPicker';
import { Modal } from './Modal';

type Props = {
  block: Block | null;
  date: string;
  startMin: number;
  contexts: Context[];
  members: Member[];
  tasks: Task[];
  defaultContextId: string;
  onClose: () => void;
};

export function BlockDialog({
  block,
  date,
  startMin,
  contexts,
  members,
  tasks,
  defaultContextId,
  onClose,
}: Props) {
  const [title, setTitle] = useState(block?.title ?? '');
  const [contextId, setContextId] = useState(block?.contextId ?? defaultContextId);
  /*
   * Ein ganztägiger Termin hat keine Uhrzeit; gespeichert steht dort 0.
   * Übernähme man das, stünde beim Zurückschalten 00:00 bis 00:00 da –
   * ungültig, und „Speichern" bliebe grau, ohne zu sagen warum. Deshalb
   * bekommt er eine brauchbare Vorgabe, die man nur noch anpassen muss.
   */
  const basisStart = block?.allDay ? 9 * 60 : (block?.startMin ?? startMin);
  const basisDauer = block?.allDay ? 60 : (block?.durationMin ?? 60);
  const [start, setStart] = useState(formatTime(basisStart));
  const [end, setEnd] = useState(formatTime(basisStart + basisDauer));

  const [allDay, setAllDay] = useState(Boolean(block?.allDay));
  const [memberIds, setMemberIds] = useState(block ? memberIdsOf(block) : []);

  /*
   * Hängt der Block an einer Aufgabe, gilt deren Zuordnung. Sie hier ein
   * zweites Mal zu setzen, würde sie nur auseinanderlaufen lassen.
   */
  const task = block?.taskId ? tasks.find((t) => t.id === block.taskId) : undefined;

  const startValue = parseTime(start);
  const endValue = parseTime(end);
  // Ganztägig braucht keine gültigen Zeiten – es hat schlicht keine.
  const valid = allDay || (startValue !== null && endValue !== null && endValue > startValue);

  const save = () => {
    if (!valid) return;
    const payload = {
      title: title.trim() || 'Termin',
      contextId,
      allDay,
      startMin: allDay ? 0 : startValue!,
      durationMin: allDay ? 0 : endValue! - startValue!,
      ...(task ? {} : { memberIds }),
    };
    if (block) updateBlock(block.id, payload);
    else addFixedBlock({ ...payload, date });
    onClose();
  };

  return (
    <Modal
      title={block ? 'Termin bearbeiten' : 'Fester Termin'}
      onClose={onClose}
      footer={
        <>
          {block && (
            <button
              className="btn danger ghost"
              onClick={() => {
                deleteBlock(block.id);
                onClose();
              }}
            >
              Löschen
            </button>
          )}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={save} disabled={!valid}>
            Speichern
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field">
          <span>Titel</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Team-Meeting"
          />
        </label>
        <label className="check-field">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>Ganztägig</span>
        </label>
        <div className="field-row">
          {/* Ohne Uhrzeit gibt es nichts einzutragen – die Felder fielen sonst leer an. */}
          {!allDay && (
            <>
              <label className="field">
                <span>Von</span>
                <input
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  placeholder="09:00"
                />
              </label>
              <label className="field">
                <span>Bis</span>
                <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="10:00" />
              </label>
            </>
          )}
          <label className="field">
            <span>Bereich</span>
            <select value={contextId} onChange={(e) => setContextId(e.target.value)}>
              {contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {task ? (
          <p className="hint">Zuständig ist, wer bei der Aufgabe „{task.title}" eingetragen ist.</p>
        ) : (
          <MemberPicker members={members} value={memberIds} onChange={setMemberIds} />
        )}

        {!valid && <p className="hint warn">Bitte Zeiten als HH:MM angeben, Ende nach Beginn.</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
