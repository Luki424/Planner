import { useEffect, useRef, useState } from 'react';
import { lohntEintrag, ortungsFehler } from '../domain/standort';
import type { AppState } from '../domain/types';
import { reportPlace } from '../storage/store';

/**
 * Den eigenen Standort melden, solange geteilt wird.
 *
 * **Nur während der Planer offen und sichtbar ist.** Ein Browser kann das
 * nicht im Hintergrund – kein Trick ändert daran etwas, und so zu tun, als
 * ob, wäre das Gefährlichste an dieser Funktion: Man verließe sich im
 * Notfall auf einen Punkt von vorgestern.
 *
 * Im Hintergrund wird die Ortung deshalb ausdrücklich abgeschaltet. Ein
 * Mikrofon oder ein GPS, das in einem Tab weiterläuft, den niemand ansieht,
 * ist genau das, was man nicht will.
 */
export function usePlaceSharing(state: AppState, memberId: string | null, aktiv: boolean) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [zuletzt, setZuletzt] = useState<number | null>(null);

  /* Der Griff ins Jetzt: Die Ortung meldet sich später, der Zustand ist dann ein anderer. */
  const orteRef = useRef(state.places);
  orteRef.current = state.places;

  useEffect(() => {
    if (!aktiv || !memberId || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    let wache: number | null = null;

    const start = () => {
      if (wache !== null || document.hidden) return;
      wache = navigator.geolocation.watchPosition(
        (pos) => {
          setFehler(null);
          setZuletzt(Date.now());
          const neu = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          const alt = orteRef.current.find((p) => p.memberId === memberId) ?? null;
          // Nicht bei jedem Zucken schreiben – siehe `lohntEintrag`.
          if (!lohntEintrag(alt, neu)) return;
          reportPlace({
            memberId,
            lat: neu.lat,
            lon: neu.lon,
            accuracyM: pos.coords.accuracy,
          });
        },
        (err) => setFehler(ortungsFehler(err.code)),
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 },
      );
    };

    const stopp = () => {
      if (wache === null) return;
      navigator.geolocation.clearWatch(wache);
      wache = null;
    };

    const beiSicht = () => (document.hidden ? stopp() : start());
    start();
    document.addEventListener('visibilitychange', beiSicht);

    return () => {
      document.removeEventListener('visibilitychange', beiSicht);
      stopp();
    };
  }, [aktiv, memberId]);

  return { fehler, zuletzt };
}
