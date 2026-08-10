import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { erinnerungsText, faelligeErinnerungen, type Erinnerung } from '../domain/reminders';
import type { AppState } from '../domain/types';
import { amUnterenRand, useVisualViewport } from '../hooks/useVisualViewport';
import { beiGeraetewechsel, ladeGemeldet, ladeVorlauf, speichereGemeldet } from '../storage/geraet';

/** So oft wird nachgesehen. Feiner als eine Minute bringt nichts. */
const TAKT_MS = 20_000;

/**
 * „In 15 Minuten: Zahnarzt (10:00)".
 *
 * Erinnerungen vor Terminen – mit einer Grenze, die offen dazugehört: Es
 * gibt keinen Server, der etwas schicken könnte. Erinnert wird deshalb nur,
 * **solange der Planer offen ist**. Steht er im Hintergrund und ist die
 * Benachrichtigung erlaubt, kommt sie als Systemmeldung; ist die App
 * geschlossen, kommt nichts.
 *
 * Das ist wenig, und es wird nicht schöngeredet – aber es ist mehr als
 * nichts: Wer den Tagesplan ohnehin offen hat, wird an den Termin erinnert,
 * statt ihn zu übersehen.
 */
export function ReminderBar({ state, today }: { state: AppState; today: string }) {
  const vorlauf = useSyncExternalStore(beiGeraetewechsel, ladeVorlauf, () => 0 as const);
  const [offen, setOffen] = useState<Erinnerung[]>([]);
  const gemeldetRef = useRef<Set<string>>(new Set());
  const tagRef = useRef(today);
  const sichtfeld = useVisualViewport(offen.length > 0);

  // Beim Tageswechsel fängt der Merkzettel von vorn an.
  if (tagRef.current !== today) {
    tagRef.current = today;
    gemeldetRef.current = ladeGemeldet(today);
  }

  const pruefen = useCallback(() => {
    if (vorlauf <= 0) return;
    if (gemeldetRef.current.size === 0) gemeldetRef.current = ladeGemeldet(today);
    const jetzt = new Date();
    const jetztMin = jetzt.getHours() * 60 + jetzt.getMinutes();
    const neu = faelligeErinnerungen(state, today, jetztMin, vorlauf, gemeldetRef.current);
    if (neu.length === 0) return;

    for (const e of neu) gemeldetRef.current.add(e.id);
    speichereGemeldet(today, gemeldetRef.current);
    setOffen((alt) => [...alt, ...neu]);

    /*
     * Zusätzlich als Systemmeldung, wenn erlaubt – nur dann sieht man sie
     * auch, während der Planer im Hintergrund liegt. Um die Erlaubnis wird
     * beim Einschalten gebeten, nicht hier: Ein Browser fragt nur auf einen
     * Fingertipp hin.
     */
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      for (const e of neu) {
        try {
          new Notification('Tagesplaner', { body: erinnerungsText(e), tag: e.id });
        } catch {
          // Manche Browser erlauben das nur über den Service Worker – dann eben nur im Streifen.
        }
      }
    }
  }, [state, today, vorlauf]);

  useEffect(() => {
    if (vorlauf <= 0) {
      setOffen([]);
      return;
    }
    pruefen();
    const uhr = setInterval(pruefen, TAKT_MS);
    /*
     * Auch beim Zurückkommen sofort nachsehen: Ein Takt von zwanzig
     * Sekunden ist zu grob, wenn man das Handy nach einer halben Stunde
     * wieder aufklappt.
     */
    const beiSicht = () => !document.hidden && pruefen();
    document.addEventListener('visibilitychange', beiSicht);
    return () => {
      clearInterval(uhr);
      document.removeEventListener('visibilitychange', beiSicht);
    };
  }, [pruefen, vorlauf]);

  if (offen.length === 0) return null;

  return (
    <div
      className="reminder-bar"
      role="alert"
      /*
       * Über der Blase, nicht auf ihr: Die Assistenten-Blase sitzt am Handy
       * 72 bis 124 Pixel über dem unteren Rand, der Streifen muss darüber
       * bleiben. Seitlich nur ein schmaler Rand – mit demselben Abstand wie
       * unten blieben von 412 Pixeln 244, und der Satz stünde als Säule da.
       */
      style={amUnterenRand(sichtfeld, sichtfeld.scale > 1.02 ? 12 : 140, 12)}
    >
      <span aria-hidden="true">⏰</span>
      <div className="reminder-texts">
        {offen.map((e) => (
          <span key={e.id} className="reminder-text">
            {erinnerungsText(e)}
          </span>
        ))}
      </div>
      <button className="btn tiny" onClick={() => setOffen([])}>
        Verstanden
      </button>
    </div>
  );
}
