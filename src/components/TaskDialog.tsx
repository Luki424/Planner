import { useState } from 'react';
import { memberIdsOf } from '../domain/people';
import type { Context, Member, Task } from '../domain/types';
import { addTask, deleteTask, updateTask } from '../storage/store';
import { MemberPicker } from './MemberPicker';
import { Modal } from './Modal';

type Props = {
  task: Task | null;
  contexts: Context[];
  members: Member[];
  defaultContextId: string;
  defaultDueDate?: string | null;
  onClose: () => void;
};

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

export function TaskDialog({
  task,
  contexts,
  members,
  defaultContextId,
  defaultDueDate,
  onClose,
}: Props) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [contextId, setContextId] = useState(task?.contextId ?? defaultContextId);
  const [estimateMin, setEstimateMin] = useState(task?.estimateMin ?? 30);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDueDate ?? '');
  const [memberIds, setMemberIds] = useState(task ? memberIdsOf(task) : []);

  const save = () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      notes,
      contextId,
      estimateMin,
      dueDate: dueDate || null,
      memberIds,
    };
    if (task) updateTask(task.id, payload);
    else addTask(payload);
    onClose();
  };

  return (
    <Modal
      title={task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
      onClose={onClose}
      footer={
        <>
          {task && (
            <button
              className="btn danger ghost"
              onClick={() => {
                deleteTask(task.id);
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
          <button className="btn primary" onClick={save} disabled={!title.trim()}>
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Was steht an?" />
        </label>

        <div className="field-row">
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

          <label className="field">
            <span>Dauer</span>
            <select value={estimateMin} onChange={(e) => setEstimateMin(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} h`}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Fällig bis</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>

        <MemberPicker members={members} value={memberIds} onChange={setMemberIds} />

        <label className="field">
          <span>Notizen</span>
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {task?.seriesId && (
          <p className="hint">
            Diese Aufgabe stammt aus einer Serie. Änderungen gelten nur für diesen Termin.
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
