import { useEffect, useRef } from 'react';
import { istWeckwort, ohneWeckwort } from '../domain/weckwort';

/*
 * Zugriff auf die Web Speech API – dieselben Typen wie in `useSpeech`, hier
 * noch einmal knapp, weil die Standard-Bibliothek sie nicht kennt.
 */
type ErkennungsErgebnis = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string; confidence: number };
};
type ErkennungsEreignis = {
  resultIndex: number;
  results: { length: number; [index: number]: ErkennungsErgebnis };
};
type Erkennung = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: ErkennungsEreignis) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};
type ErkennungsBauer = new () => Erkennung;

function bauer(): ErkennungsBauer | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: ErkennungsBauer;
    webkitSpeechRecognition?: ErkennungsBauer;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/** Nach einem Abbruch kurz durchatmen, statt in eine Schleife zu rennen. */
const PAUSE_MS = 400;
/** Nach so vielen Fehlversuchen am Stück wird aufgegeben. */
const MAX_FEHLER = 8;

/**
 * Hört im Hintergrund auf „Hey Planer".
 *
 * Bewusst ein eigener Haken und nicht `useSpeech`: Der dort dient einem
 * Diktat mit Anfang und Ende, dieser läuft, bis man ihn abschaltet, und
 * liefert nichts ab außer dem Weckruf.
 *
 * Drei Dinge, die man wissen muss, und die auch in den Einstellungen stehen:
 *
 * 1. **Nur solange die Seite offen und sichtbar ist.** Einen Dienst, der im
 *    Hintergrund weiterhört, gibt es im Browser nicht – und wir hätten auch
 *    keinen Ort, an dem er laufen könnte.
 * 2. **Das Mikrofon bleibt an.** Das kostet Akku, und der Browser zeigt es
 *    an. Deshalb ist es abschaltbar und standardmäßig aus.
 * 3. **Die Erkennung läuft über den Browserhersteller.** Chrome schickt den
 *    Ton zur Auswertung an Google – bei jedem Diktat auch, hier eben
 *    dauernd. Wer das nicht will, lässt es aus und tippt.
 */
export function useWakeWord(aktiv: boolean, aufWeckruf: (rest: string) => void) {
  const rufRef = useRef(aufWeckruf);
  rufRef.current = aufWeckruf;

  useEffect(() => {
    const Bauer = bauer();
    if (!aktiv || !Bauer) return;

    let lebt = true;
    let erkennung: Erkennung | null = null;
    let fehler = 0;
    let uhr: ReturnType<typeof setTimeout> | null = null;

    const starten = () => {
      if (!lebt || document.hidden) return;
      erkennung?.abort();
      const e = new Bauer();
      erkennung = e;
      e.lang = 'de-DE';
      /*
       * Kein Dauerbetrieb, aus demselben Grund wie beim Diktat: Auf
       * Android-Chrome geht damit das Mikrofon an und es kommt nie ein
       * Ergebnis. Getragen wird das Zuhören von der Schleife unten.
       */
      e.continuous = false;
      e.interimResults = true;
      e.maxAlternatives = 1;

      e.onresult = (ereignis) => {
        for (let i = ereignis.resultIndex; i < ereignis.results.length; i += 1) {
          const text = ereignis.results[i][0]?.transcript ?? '';
          if (!istWeckwort(text)) continue;
          /*
           * Beim Zwischenergebnis genügt der Weckruf allein; der Rest des
           * Satzes wird erst mit dem Endergebnis vollständig. Deshalb wird
           * nur auf ein endgültiges Ergebnis hin gefragt – sonst ginge
           * „Hey Planer, was steht Donnerstag an" als „Hey Planer, was"
           * hinaus.
           */
          if (!ereignis.results[i].isFinal) continue;
          lebt = false;
          e.abort();
          rufRef.current(ohneWeckwort(text));
          return;
        }
      };

      e.onerror = (fehlerEreignis) => {
        // Ohne Erlaubnis hat das Zuhören keinen Sinn – dann eben gar nicht.
        if (
          fehlerEreignis.error === 'not-allowed' ||
          fehlerEreignis.error === 'service-not-allowed'
        ) {
          lebt = false;
        }
        fehler += 1;
      };

      e.onend = () => {
        if (!lebt) return;
        if (fehler > MAX_FEHLER) return;
        uhr = setTimeout(starten, PAUSE_MS);
      };

      e.onstart = () => {
        fehler = 0;
      };

      try {
        e.start();
      } catch {
        // Schon gestartet oder verweigert – die Schleife versucht es gleich erneut.
        fehler += 1;
        uhr = setTimeout(starten, PAUSE_MS);
      }
    };

    /*
     * Im Hintergrund wird nicht zugehört. Das spart Akku und ist auch das
     * ehrlichere Verhalten: In einem Tab, den niemand ansieht, soll kein
     * Mikrofon laufen.
     */
    const beiSichtwechsel = () => {
      if (document.hidden) {
        erkennung?.abort();
        if (uhr) clearTimeout(uhr);
      } else {
        starten();
      }
    };
    document.addEventListener('visibilitychange', beiSichtwechsel);
    starten();

    return () => {
      lebt = false;
      document.removeEventListener('visibilitychange', beiSichtwechsel);
      if (uhr) clearTimeout(uhr);
      erkennung?.abort();
      erkennung = null;
    };
  }, [aktiv]);
}
