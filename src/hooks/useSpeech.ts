import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Zugriff auf die Web Speech API. Die Typen fehlen in der Standard-DOM-Bibliothek,
 * deshalb hier nur das, was tatsächlich benutzt wird.
 */

type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
};
type SpeechRecognitionErrorLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type SpeechStatus = 'unsupported' | 'idle' | 'listening' | 'denied' | 'error';

export type UseSpeech = {
  status: SpeechStatus;
  /** Was gerade verstanden wird, noch nicht endgültig. */
  interim: string;
  /** Letzte Fehlermeldung in Klartext, sonst null. */
  message: string | null;
  start: () => void;
  stop: () => void;
  supported: boolean;
};

const ERROR_TEXT: Record<string, string> = {
  'not-allowed': 'Zugriff auf das Mikrofon wurde abgelehnt. Erlaube ihn in den Browser-Einstellungen.',
  'service-not-allowed': 'Der Browser lässt die Spracherkennung hier nicht zu.',
  'no-speech': 'Nichts gehört. Tippe noch einmal auf das Mikrofon.',
  'audio-capture': 'Kein Mikrofon gefunden.',
  network: 'Die Spracherkennung braucht eine Internetverbindung.',
  aborted: '',
};

/*
 * Fehler, die kein Fehler sind.
 *
 * Am Handy meldet die Erkennung ständig „no-speech" – jede Atempause reicht.
 * Als Fehler behandelt sah die Aufnahme dann kaputt aus, obwohl nur kurz
 * niemand gesprochen hat. „aborted" kommt bei jedem bewussten Abbruch.
 */
const HARMLOS = new Set(['no-speech', 'aborted']);

/**
 * Nach so vielen Millisekunden Stille endet die Aufnahme von selbst.
 * Mit `continuous` hört die Erkennung sonst gar nicht mehr auf.
 */
const STILLE_MS = 2500;

/**
 * Vor dem ersten Wort darf es länger dauern – das Mikrofon antippen, das
 * Gerät ans Ohr nehmen und überlegen kostet mehr als zweieinhalb Sekunden.
 */
const ERSTE_STILLE_MS = 7000;

/**
 * So oft darf eine Sitzung, die der Browser von sich aus beendet hat, neu
 * gestartet werden. Android beendet sie gern nach jedem Satzteil; ohne
 * Neustart bricht das Diktat mitten im Satz ab.
 */
const MAX_NEUSTARTS = 6;

/**
 * Nimmt einen gesprochenen Satz auf und meldet ihn als Text zurück.
 * Die Erkennung endet automatisch nach einer Sprechpause.
 */
export function useSpeech(onResult: (text: string) => void, lang = 'de-DE'): UseSpeech {
  const [status, setStatus] = useState<SpeechStatus>(() => (getConstructor() ? 'idle' : 'unsupported'));
  const [interim, setInterim] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  /** Will der Benutzer noch zuhören lassen? Steuert den Neustart. */
  const gewolltRef = useRef(false);
  const neustartsRef = useRef(0);
  const stilleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gehoertRef = useRef('');

  const stilleAbbrechen = useCallback(() => {
    if (stilleRef.current) clearTimeout(stilleRef.current);
    stilleRef.current = null;
  }, []);

  useEffect(
    () => () => {
      gewolltRef.current = false;
      if (stilleRef.current) clearTimeout(stilleRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  /** Startet eine Sitzung. `fortsetzung` heißt: der Browser hat abgebrochen. */
  const sitzungStarten = useCallback(
    (fortsetzung: boolean) => {
      const Constructor = getConstructor();
      if (!Constructor) {
        setStatus('unsupported');
        return;
      }
      recognitionRef.current?.abort();

      const recognition = new Constructor();
      recognition.lang = lang;
      /*
       * `continuous` ist der Unterschied zwischen „ein Wort" und „ein Satz".
       * Ohne ihn endet die Erkennung bei der ersten Atempause – bei
       * „Zahnarzttermin am Dienstag … um zehn" kam nur der erste Teil an.
       * Beendet wird stattdessen über die Stille-Uhr unten.
       */
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setMessage(null);
        setStatus('listening');
        /*
         * Auch ohne ein einziges Wort muss die Aufnahme enden. Ohne diese
         * Frist bliebe das Mikrofon offen, wenn jemand es antippt und dann
         * doch nichts sagt – die Uhr wird sonst nur von Ergebnissen gestellt.
         */
        if (!gehoertRef.current) stilleUhrStellen(ERSTE_STILLE_MS);
      };

      /** Nach einer Sprechpause von selbst beenden und abliefern. */
      const stilleUhrStellen = (ms: number) => {
        stilleAbbrechen();
        stilleRef.current = setTimeout(() => {
          gewolltRef.current = false;
          recognitionRef.current?.stop();
        }, ms);
      };

      recognition.onresult = (event) => {
        let finalText = '';
        let pending = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? '';
          if (result.isFinal) finalText += text;
          else pending += text;
        }
        if (finalText.trim()) {
          // Bei `continuous` kommen mehrere Endstücke – sie ergeben zusammen
          // den Satz und werden erst am Schluss ausgewertet.
          gehoertRef.current = `${gehoertRef.current} ${finalText.trim()}`.trim();
        }
        setInterim(pending || gehoertRef.current);
        // Jedes Wort verlängert die Aufnahme.
        if (finalText.trim() || pending.trim()) {
          neustartsRef.current = 0;
          stilleUhrStellen(STILLE_MS);
        }
      };

      recognition.onerror = (event) => {
        if (HARMLOS.has(event.error)) {
          // Nicht als Fehler zeigen – onend entscheidet, wie es weitergeht.
          if (event.error === 'no-speech' && !gehoertRef.current) setMessage(ERROR_TEXT['no-speech']);
          return;
        }
        gewolltRef.current = false;
        stilleAbbrechen();
        const text = ERROR_TEXT[event.error] ?? `Spracherkennung fehlgeschlagen (${event.error}).`;
        setStatus(event.error === 'not-allowed' ? 'denied' : 'error');
        setMessage(text || null);
      };

      recognition.onend = () => {
        /*
         * Android beendet die Sitzung gern von sich aus, mitten im Satz.
         * Solange der Benutzer nicht gestoppt hat, wird weitergehört – aber
         * begrenzt, damit eine hakende Erkennung keine Endlosschleife wird.
         */
        if (gewolltRef.current && neustartsRef.current < MAX_NEUSTARTS) {
          neustartsRef.current += 1;
          sitzungStarten(true);
          return;
        }
        stilleAbbrechen();
        gewolltRef.current = false;
        setInterim('');
        setStatus((current) => (current === 'listening' ? 'idle' : current));
        const satz = gehoertRef.current.trim();
        gehoertRef.current = '';
        if (satz) resultRef.current(satz);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // Ein zweites start() während einer laufenden Aufnahme wirft – harmlos.
        if (!fortsetzung) setStatus('idle');
      }
    },
    [lang, stilleAbbrechen],
  );

  const start = useCallback(() => {
    gewolltRef.current = true;
    neustartsRef.current = 0;
    gehoertRef.current = '';
    setInterim('');
    setMessage(null);
    sitzungStarten(false);
  }, [sitzungStarten]);

  const stop = useCallback(() => {
    gewolltRef.current = false;
    stilleAbbrechen();
    recognitionRef.current?.stop();
  }, [stilleAbbrechen]);

  return {
    status,
    interim,
    message,
    start,
    stop,
    supported: status !== 'unsupported',
  };
}
