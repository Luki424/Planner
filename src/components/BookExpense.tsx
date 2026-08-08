import { useState } from 'react';
import { CATEGORIES, parseAmount } from '../domain/budget';
import { formatEuro } from '../domain/voice';
import type { AppState } from '../domain/types';
import { bookDoneAsExpense } from '../storage/store';
import { MemberPicker } from './MemberPicker';
import { ReceiptPicker } from './ReceiptPicker';

type Props = {
  state: AppState;
  today: string;
  /** Wer gerade angemeldet ist – steht später am Beleg. */
  displayName?: string | null;
  /** Summe der Schätzungen im Wagen – Vorschlag für den Betrag. */
  estimatedCents: number;
  count: number;
  onClose: () => void;
};

/**
 * Bucht den Wagen als Ausgabe.
 *
 * Der Betrag ist mit der Schätzung vorbelegt, lässt sich aber überschreiben –
 * genau dafür ist die Kasse da: der Bon sagt oft etwas anderes als die Liste,
 * und erst dieser Unterschied macht die Schätzungen mit der Zeit besser.
 */
export function BookExpense({
  state,
  today,
  displayName = null,
  estimatedCents,
  count,
  onClose,
}: Props) {
  const [betrag, setBetrag] = useState(
    estimatedCents > 0 ? (estimatedCents / 100).toFixed(2).replace('.', ',') : '',
  );
  const [title, setTitle] = useState('Einkauf');
  const [category, setCategory] = useState<string>('Lebensmittel');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [beleg, setBeleg] = useState<string | null>(null);

  const cents = parseAmount(betrag);
  const abweichung = cents !== null && estimatedCents > 0 ? cents - estimatedCents : null;

  return (
    <form
      className="absence-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (cents === null) return;
        bookDoneAsExpense({
          date,
          title,
          cents,
          category,
          memberIds,
          receipt: beleg,
          receiptBy: displayName,
        });
        onClose();
      }}
    >
      <p className="hint">
        {count} {count === 1 ? 'Position' : 'Positionen'} im Wagen
        {estimatedCents > 0 && `, geschätzt ${formatEuro(estimatedCents)}`}. Trag ein, was auf dem
        Bon steht – die Liste wird danach aufgeräumt.
      </p>

      <div className="field-row tight">
        <label className="field">
          <span>Wofür</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Wofür" />
        </label>
        <label className="field narrow">
          <span>Bezahlt</span>
          <input
            className="price-input"
            value={betrag}
            onChange={(e) => setBetrag(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            aria-label="Bezahlter Betrag"
          />
        </label>
      </div>

      {abweichung !== null && abweichung !== 0 && (
        <p className="hint">
          {abweichung > 0 ? 'Teurer' : 'Günstiger'} als geschätzt:{' '}
          {formatEuro(Math.abs(abweichung))}.
        </p>
      )}

      <div className="field-row tight">
        <label className="field">
          <span>Kategorie</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Wann</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <MemberPicker
        members={state.members}
        value={memberIds}
        onChange={setMemberIds}
        label="Wer hat bezahlt"
        emptyHint="Ohne Angabe zählt die Ausgabe als gemeinsam getragen."
      />

      {/*
        Der Beleg steht unter dem Betrag, nicht darüber: Erst wird gebucht,
        was zählt, dann kommt das Bild dazu – wer nur schnell buchen will,
        muss sich nicht erst an einer Kamera vorbeiarbeiten.
      */}
      <ReceiptPicker value={beleg} onChange={setBeleg} />
      <p className="hint">
        Der Bon wird nur abgelegt, nicht gelesen – den Betrag trägst du oben ein. Zum Nachschauen
        später, was im Einkauf war.
      </p>

      {betrag.trim() !== '' && cents === null && (
        <p className="hint warn">Betrag bitte als Zahl, z.B. 42,90.</p>
      )}

      <div className="button-row">
        <button className="btn ghost" type="button" onClick={onClose}>
          Abbrechen
        </button>
        <span className="spacer" />
        <button className="btn primary" type="submit" disabled={cents === null}>
          Buchen und aufräumen
        </button>
      </div>
    </form>
  );
}
