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
  'no-speech': 'Nichts verstanden – bitte noch einmal.',
  'audio-capture': 'Kein Mikrofon gefunden.',
  network: 'Die Spracherkennung braucht eine Internetverbindung.',
  aborted: '',
};

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

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  const start = useCallback(() => {
    const Constructor = getConstructor();
    if (!Constructor) {
      setStatus('unsupported');
      return;
    }
    recognitionRef.current?.abort();

    const recognition = new Constructor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setMessage(null);
      setInterim('');
      setStatus('listening');
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
      setInterim(pending);
      if (finalText.trim()) {
        setInterim('');
        resultRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      const text = ERROR_TEXT[event.error] ?? `Spracherkennung fehlgeschlagen (${event.error}).`;
      setStatus(event.error === 'not-allowed' ? 'denied' : 'error');
      setMessage(text || null);
    };

    recognition.onend = () => {
      setInterim('');
      setStatus((current) => (current === 'listening' ? 'idle' : current));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Ein zweites start() während einer laufenden Aufnahme wirft – harmlos.
      setStatus('idle');
    }
  }, [lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setStatus((current) => (current === 'listening' ? 'idle' : current));
  }, []);

  return {
    status,
    interim,
    message,
    start,
    stop,
    supported: status !== 'unsupported',
  };
}
