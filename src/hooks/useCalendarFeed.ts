import { useEffect, useRef } from 'react';
import { istFaellig } from '../domain/abo';
import type { AppState } from '../domain/types';
import { gleicheKalenderAb } from '../storage/kalenderabruf';

/**
 * Den abonnierten Kalender wöchentlich abgleichen.
 *
 * Beim Öffnen des Planers und beim Zurückkommen aus dem Hintergrund –
 * anders geht es nicht: Es gibt keinen Server, der zwischendurch etwas tun
 * könnte. „Wöchentlich" heißt hier also „beim ersten Öffnen, nachdem eine
 * Woche vorbei ist".
 *
 * Im Hintergrund läuft nichts. Ein Abruf in einem Tab, den niemand ansieht,
 * wäre Datenverkehr, den man weder bemerkt noch angestoßen hat.
 */
export function useCalendarFeed(state: AppState, heute: string, bereit: boolean) {
  /*
   * Ein Lauf je Sitzung genügt, und mehr wäre schädlich: Der Abgleich
   * schreibt in den Zustand, der Zustand löst ein Rendern aus – ohne diese
   * Sperre riefe sich das gegenseitig auf.
   */
  const laeuftRef = useRef(false);
  const erledigtRef = useRef(false);

  const aboRef = useRef(state.settings.calendarFeed ?? null);
  aboRef.current = state.settings.calendarFeed ?? null;

  useEffect(() => {
    if (!bereit) return;

    const versuchen = () => {
      const jetziges = aboRef.current;
      if (!jetziges || document.hidden) return;
      if (laeuftRef.current || erledigtRef.current) return;
      if (!istFaellig(jetziges.lastRun, heute)) return;
      /*
       * Auch nach einem Fehlschlag gilt der Versuch als erledigt: Sonst
       * liefe er bei jedem Sichtwechsel erneut gegen dieselbe Wand. Von
       * Hand geht er weiterhin jederzeit.
       */
      laeuftRef.current = true;
      erledigtRef.current = true;
      void gleicheKalenderAb(jetziges).finally(() => {
        laeuftRef.current = false;
      });
    };

    versuchen();
    document.addEventListener('visibilitychange', versuchen);
    return () => document.removeEventListener('visibilitychange', versuchen);
  }, [bereit, heute]);
}
