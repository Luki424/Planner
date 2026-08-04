import { useState } from 'react';
import { formatTime, parseTime } from '../domain/dates';
import type { Block, Context } from '../domain/types';
import { addFixedBlock, deleteBlock, updateBlock } from '../storage/store';
import { Modal } from './Modal';

type Props = {
  block: Block | null;
  date: string;
  startMin: number;
  contexts: Context[];
  defaultContextId: string;
  onClose: () => void;
};

export function BlockDialog({ block, date, startMin, contexts, defaultContextId, onClose }: Props) {
  const [title, setTitle] = useState(block?.title ?? '');
  const [contextId, setContextId] = useState(block?.contextId ?? defaultContextId);
  const [start, setStart] = useState(formatTime(block?.startMin ?? startMin));
  const [end, setEnd] = useState(
    formatTime((block?.startMin ?? startMin) + (block?.durationMin ?? 60)),
  );

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
        {!valid && <p className="hint warn">Bitte Zeiten als HH:MM angeben, Ende nach Beginn.</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
