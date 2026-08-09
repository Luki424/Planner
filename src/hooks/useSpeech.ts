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
  'not-allowed':
    'Das Mikrofon ist gesperrt. In Chrome: auf das Schloss neben der Adresse tippen → Berechtigungen → Mikrofon erlauben.',
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
 *
 * Die Erkennung endet zwar auch von sich aus – aber erst nach dem Neustart
 * wieder, und der käme sonst endlos.
 */
const STILLE_MS = 2500;

/**
 * Vor dem ersten Wort darf es länger dauern – das Mikrofon antippen, das
 * Gerät ans Ohr nehmen und überlegen kostet mehr als zweieinhalb Sekunden.
 */
const ERSTE_STILLE_MS = 7000;

/**
 * So oft darf eine Sitzung, die der Browser von sich aus beendet hat, neu
 * gestartet werden.
 *
 * Ohne Dauerbetrieb endet jede Sitzung nach einem Satzteil – der Neustart
 * ist damit der Normalfall, nicht die Ausnahme, und die Grenze entsprechend
 * großzügig. Sie greift nur, wenn zwischendurch *nichts* verstanden wurde:
 * Jedes gehörte Wort setzt den Zähler zurück.
 */
const MAX_NEUSTARTS = 12;

/**
 * So lange darf es dauern, bis der Browser die Aufnahme bestätigt.
 *
 * Auf einem Android-Handy, auf dem der Planer als App vom Startbildschirm
 * läuft, tut `start()` nichts: kein `onstart`, kein `onerror`, kein
 * geworfener Fehler – der Knopf sieht einfach kaputt aus. Die Frist macht
 * dieses Schweigen sichtbar und stößt die Rettung an.
 */
const START_FRIST_MS = 2500;

/**
 * Holt die Mikrofonerlaubnis ausdrücklich ein.
 *
 * Die Spracherkennung fragt selbst danach – aber nicht in einer vom
 * Startbildschirm gestarteten App. Dort bleibt die Frage aus, und mit ihr
 * die Aufnahme. Über `getUserMedia` erscheint sie zuverlässig; der Ton wird
 * sofort wieder freigegeben, sonst blockiert er die Erkennung.
 */
async function erlaubnisEinholen(): Promise<string | null> {
  const geraete = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  if (!geraete?.getUserMedia) {
    return 'Dieser Browser gibt kein Mikrofon frei. Über eine verschlüsselte Verbindung (https) klappt es.';
  }
  try {
    const stream = await geraete.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return null;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return ERROR_TEXT['not-allowed'];
    if (name === 'NotFoundError') return ERROR_TEXT['audio-capture'];
    return `Das Mikrofon ließ sich nicht öffnen (${name || 'unbekannt'}).`;
  }
}

/**
 * Nimmt einen gesprochenen Satz auf und meldet ihn als Text zurück.
 * Die Erkennung endet automatisch nach einer Sprechpause.
 */
export function useSpeech(onResult: (text: string) => void, lang = 'de-DE'): UseSpeech {
  const [status, setStatus] = useState<SpeechStatus>(() =>
    getConstructor() ? 'idle' : 'unsupported',
  );
  const [interim, setInterim] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  /** Will der Benutzer noch zuhören lassen? Steuert den Neustart. */
  const gewolltRef = useRef(false);
  const neustartsRef = useRef(0);
  const stilleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fristRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gehoertRef = useRef('');
  /*
   * Zuletzt Gehörtes, das noch nicht als endgültig markiert war.
   *
   * Android liefert beim Beenden nicht immer ein Schlussergebnis. Ohne
   * diesen Rückhalt sah man den Satz auf dem Schirm und bekam trotzdem
   * nichts – das Gesprochene war weg.
   */
  const vorlaeufigRef = useRef('');
  /** Wurde die Erlaubnis schon einmal ausdrücklich geholt? Bremst die Schleife. */
  const erlaubnisVersuchtRef = useRef(false);
  const lebtRef = useRef(true);
  /*
   * Die Rettung ruft ihrerseits den Start auf. Über eine Ablage statt über
   * eine Abhängigkeit, sonst zeigten beide aufeinander und würden sich bei
   * jedem Rendern gegenseitig neu bauen.
   */
  const rettungRef = useRef<() => void>(() => {});

  const stilleAbbrechen = useCallback(() => {
    if (stilleRef.current) clearTimeout(stilleRef.current);
    stilleRef.current = null;
  }, []);

  const fristAbbrechen = useCallback(() => {
    if (fristRef.current) clearTimeout(fristRef.current);
    fristRef.current = null;
  }, []);

  useEffect(() => {
    // Ausdrücklich auch beim Einhängen setzen: im Entwicklungsmodus hängt
    // React jede Komponente einmal aus und wieder ein.
    lebtRef.current = true;
    return () => {
      lebtRef.current = false;
      gewolltRef.current = false;
      if (stilleRef.current) clearTimeout(stilleRef.current);
      if (fristRef.current) clearTimeout(fristRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

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
       * Kein Dauerbetrieb.
       *
       * `continuous` klang nach der richtigen Antwort auf „der Satz bricht
       * mittendrin ab" – auf Android-Chrome ist er aber wirkungslos bis
       * schädlich: Das Mikrofon geht an, `onstart` kommt, und dann kommt
       * nie ein Ergebnis. Am Bildschirm fiel das nicht auf.
       *
       * Den langen Satz trägt stattdessen die Neustart-Schleife unten: Die
       * Erkennung endet nach jedem Satzteil von selbst, das Gehörte wird
       * gesammelt, und solange der Benutzer nicht gestoppt hat, geht es
       * weiter. Das ist eine Mechanik statt zweier – und sie funktioniert
       * überall gleich.
       */
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      /** Nach einer Sprechpause von selbst beenden und abliefern. */
      const stilleUhrStellen = (ms: number) => {
        stilleAbbrechen();
        stilleRef.current = setTimeout(() => {
          gewolltRef.current = false;
          recognitionRef.current?.stop();
        }, ms);
      };

      recognition.onstart = () => {
        fristAbbrechen();
        setMessage(null);
        setStatus('listening');
        /*
         * Auch ohne ein einziges Wort muss die Aufnahme enden. Ohne diese
         * Frist bliebe das Mikrofon offen, wenn jemand es antippt und dann
         * doch nichts sagt – die Uhr wird sonst nur von Ergebnissen gestellt.
         */
        if (!gehoertRef.current) stilleUhrStellen(ERSTE_STILLE_MS);
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
          // Über mehrere Sitzungen hinweg kommen mehrere Endstücke – sie
          // ergeben zusammen den Satz und werden erst am Schluss ausgewertet.
          gehoertRef.current = `${gehoertRef.current} ${finalText.trim()}`.trim();
          vorlaeufigRef.current = '';
        } else if (pending.trim()) {
          vorlaeufigRef.current = pending.trim();
        }
        setInterim(pending || gehoertRef.current);
        // Jedes Wort verlängert die Aufnahme.
        if (finalText.trim() || pending.trim()) {
          neustartsRef.current = 0;
          stilleUhrStellen(STILLE_MS);
        }
      };

      recognition.onerror = (event) => {
        fristAbbrechen();
        if (HARMLOS.has(event.error)) {
          // Nicht als Fehler zeigen – onend entscheidet, wie es weitergeht.
          if (event.error === 'no-speech' && !gehoertRef.current)
            setMessage(ERROR_TEXT['no-speech']);
          return;
        }
        gewolltRef.current = false;
        stilleAbbrechen();
        /*
         * „not-allowed" ist am Handy oft kein endgültiges Nein, sondern ein
         * „danach hat niemand gefragt". Also einmal ausdrücklich fragen und
         * es noch einmal versuchen, statt den Benutzer in die Einstellungen
         * zu schicken.
         */
        if (event.error === 'not-allowed' && !erlaubnisVersuchtRef.current) {
          rettungRef.current();
          return;
        }
        const text = ERROR_TEXT[event.error] ?? `Spracherkennung fehlgeschlagen (${event.error}).`;
        setStatus(event.error === 'not-allowed' ? 'denied' : 'error');
        setMessage(text || null);
      };

      recognition.onend = () => {
        fristAbbrechen();
        /*
         * Android beendet die Sitzung gern von sich aus, mitten im Satz.
         * Solange der Benutzer nicht gestoppt hat, wird weitergehört – aber
         * begrenzt, damit eine hakende Erkennung keine Endlosschleife wird.
         */
        if (gewolltRef.current && neustartsRef.current < MAX_NEUSTARTS) {
          neustartsRef.current += 1;
          /*
           * Kurz Luft lassen. Endet die Erkennung sofort wieder – etwa weil
           * gar kein Ton ankommt –, liefe der Neustart sonst als enge
           * Schleife und hielte das Gerät auf Trab, ohne dass jemand etwas
           * davon hätte.
           */
          setTimeout(() => {
            if (lebtRef.current && gewolltRef.current) sitzungStarten(true);
          }, 150);
          return;
        }
        stilleAbbrechen();
        gewolltRef.current = false;
        setInterim('');
        setStatus((current) => (current === 'listening' ? 'idle' : current));
        /*
         * Erst das Endgültige, sonst das zuletzt vorläufig Gehörte. Lieber
         * ein Satz, den man vor dem Übernehmen noch prüft, als gar keiner.
         */
        const satz = (gehoertRef.current || vorlaeufigRef.current).trim();
        const versuche = neustartsRef.current;
        gehoertRef.current = '';
        vorlaeufigRef.current = '';
        if (satz) {
          resultRef.current(satz);
          return;
        }
        /*
         * Aufnahme vorbei und nichts verstanden – ohne Fehlermeldung. Das
         * darf nicht stumm enden: Der Benutzer hat gesprochen und sieht
         * nichts, und niemand weiß, woran es lag. Die Zahl der Anläufe
         * unterscheidet „nichts gesagt" von „es kam kein Ton an".
         */
        setMessage((jetzt) =>
          jetzt
            ? jetzt
            : versuche >= MAX_NEUSTARTS
              ? 'Das Mikrofon lief, es kam aber kein Ton an. Prüfe, ob eine andere App das Mikrofon belegt.'
              : ERROR_TEXT['no-speech'],
        );
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        /*
         * Ein zweites start() während einer laufenden Aufnahme wirft – das
         * ist harmlos und betrifft nur den Neustart. Beim ersten Anlauf ist
         * es dagegen der eigentliche Fehler und darf nicht verschwiegen
         * werden: genau das ließ den Knopf wie kaputt aussehen.
         */
        if (fortsetzung) return;
        if (!erlaubnisVersuchtRef.current) {
          rettungRef.current();
          return;
        }
        setStatus('error');
        setMessage(
          `Die Spracherkennung ließ sich nicht starten (${err instanceof Error ? err.name : 'unbekannt'}).`,
        );
        return;
      }

      /*
       * Und wenn start() weder wirkt noch meckert: nach kurzer Frist selbst
       * nachsehen. Ohne das bliebe der Knopf stumm stehen.
       */
      if (!fortsetzung) {
        fristAbbrechen();
        fristRef.current = setTimeout(() => {
          if (!lebtRef.current) return;
          if (!erlaubnisVersuchtRef.current) {
            rettungRef.current();
            return;
          }
          gewolltRef.current = false;
          recognitionRef.current?.abort();
          setStatus('error');
          setMessage(
            'Die Spracherkennung meldet sich nicht. Am Handy hilft meist, den Planer im Browser statt über das Symbol auf dem Startbildschirm zu öffnen.',
          );
        }, START_FRIST_MS);
      }
    },
    [lang, stilleAbbrechen, fristAbbrechen],
  );

  /**
   * Erlaubnis ausdrücklich holen und danach noch einmal starten.
   *
   * Genau einmal: bleibt es auch danach still, ist es kein Rechteproblem
   * mehr, und eine zweite Runde würde nur die Zeit des Benutzers kosten.
   */
  const erlaubnisHolenUndNochmal = useCallback(async () => {
    if (erlaubnisVersuchtRef.current) return;
    erlaubnisVersuchtRef.current = true;
    fristAbbrechen();
    recognitionRef.current?.abort();
    const fehler = await erlaubnisEinholen();
    if (!lebtRef.current) return;
    if (fehler) {
      gewolltRef.current = false;
      setStatus('denied');
      setMessage(fehler);
      return;
    }
    gewolltRef.current = true;
    neustartsRef.current = 0;
    sitzungStarten(false);
  }, [fristAbbrechen, sitzungStarten]);

  rettungRef.current = () => void erlaubnisHolenUndNochmal();

  const start = useCallback(() => {
    gewolltRef.current = true;
    neustartsRef.current = 0;
    gehoertRef.current = '';
    vorlaeufigRef.current = '';
    setInterim('');
    setMessage(null);
    sitzungStarten(false);
  }, [sitzungStarten]);

  const stop = useCallback(() => {
    gewolltRef.current = false;
    stilleAbbrechen();
    fristAbbrechen();
    recognitionRef.current?.stop();
  }, [stilleAbbrechen, fristAbbrechen]);

  return {
    status,
    interim,
    message,
    start,
    stop,
    supported: status !== 'unsupported',
  };
}
