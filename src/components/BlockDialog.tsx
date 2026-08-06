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
  const [start, setStart] = useState(formatTime(block?.startMin ?? startMin));
  const [end, setEnd] = useState(
    formatTime((block?.startMin ?? startMin) + (block?.durationMin ?? 60)),
  );

  const [memberIds, setMemberIds] = useState(block ? memberIdsOf(block) : []);

  /*
   * Hängt der Block an einer Aufgabe, gilt deren Zuordnung. Sie hier ein
   * zweites Mal zu setzen, würde sie nur auseinanderlaufen lassen.
   */
  const task = block?.taskId ? tasks.find((t) => t.id === block.taskId) : undefined;

  const startValue = parseTime(start);
  const endValue = parseTime(end);
  const valid = startValue !== null && endValue !== null && endValue > startValue;

  const save = () => {
    if (!valid) return;
    const payload = {
      title: title.trim() || 'Termin',
      contextId,
      startMin: startValue,
      durationMin: endValue - startValue,
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
        <div className="field-row">
          <label className="field">
            <span>Von</span>
            <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="09:00" />
          </label>
          <label className="field">
            <span>Bis</span>
            <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="10:00" />
          </label>
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
