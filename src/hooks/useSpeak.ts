import { useCallback, useEffect, useRef, useState } from 'react';
import { inHappen } from '../domain/vorlesen';

/**
 * Vorlesen über die Sprachausgabe des Browsers.
 *
 * Gegenstück zu `useSpeech`: Der eine hört zu, dieser spricht. Zusammen
 * lässt sich der Assistent bedienen, ohne hinzusehen – beim Kochen, im
 * Auto, mit dem Kind auf dem Arm.
 *
 * Zwei Eigenheiten der Browser stecken hier drin:
 *
 * 1. **Chrome bricht nach etwa fünfzehn Sekunden ab.** Deshalb wird der
 *    Text in Sätze zerlegt und Stück für Stück gesprochen (siehe
 *    `inHappen`). Jedes Stück ist kurz genug, dass der Abbruch nicht
 *    greift.
 * 2. **Die Stimmenliste kommt verspätet.** Beim ersten Aufruf ist sie oft
 *    leer; erst `voiceschanged` füllt sie. Ohne deutsche Stimme läse ein
 *    englisches Sprachrohr den deutschen Satz vor – erkennbar falsch.
 */

type Stimme = SpeechSynthesisVoice;

function ausgabe(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

export type UseSpeak = {
  supported: boolean;
  spricht: boolean;
  sprechen: (text: string) => void;
  abbrechen: () => void;
};

export function useSpeak(lang = 'de-DE'): UseSpeak {
  const [spricht, setSpricht] = useState(false);
  const stimmeRef = useRef<Stimme | null>(null);
  const lebtRef = useRef(true);
  const supported = Boolean(ausgabe());

  useEffect(() => {
    lebtRef.current = true;
    const synth = ausgabe();
    if (!synth) return;

    const stimmeWaehlen = () => {
      const alle = synth.getVoices();
      stimmeRef.current =
        alle.find((s) => s.lang === lang) ??
        alle.find((s) => s.lang.startsWith(lang.slice(0, 2))) ??
        null;
    };
    stimmeWaehlen();
    synth.addEventListener('voiceschanged', stimmeWaehlen);

    return () => {
      lebtRef.current = false;
      synth.removeEventListener('voiceschanged', stimmeWaehlen);
      /*
       * Beim Verlassen verstummen. Eine Stimme, die weiterredet, nachdem
       * man das Fenster geschlossen hat, lässt sich sonst nirgends mehr
       * abstellen – die Sprachausgabe gehört der Seite, nicht dem Bauteil.
       */
      synth.cancel();
    };
  }, [lang]);

  const abbrechen = useCallback(() => {
    ausgabe()?.cancel();
    setSpricht(false);
  }, []);

  const sprechen = useCallback(
    (text: string) => {
      const synth = ausgabe();
      if (!synth) return;
      const happen = inHappen(text);
      if (happen.length === 0) return;

      // Erst räumen: Sonst reiht sich die neue Antwort hinter die alte ein.
      synth.cancel();
      setSpricht(true);

      happen.forEach((happen_, i) => {
        const satz = new SpeechSynthesisUtterance(happen_);
        satz.lang = lang;
        if (stimmeRef.current) satz.voice = stimmeRef.current;
        if (i === happen.length - 1) {
          satz.onend = () => lebtRef.current && setSpricht(false);
        }
        satz.onerror = () => lebtRef.current && setSpricht(false);
        synth.speak(satz);
      });
    },
    [lang],
  );

  return { supported, spricht, sprechen, abbrechen };
}
