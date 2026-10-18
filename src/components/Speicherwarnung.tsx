import { useEffect, useState, useSyncExternalStore } from 'react';
import { ablagelage, beiAblagewechsel } from '../storage/db';
import { platzText, speicherplatz } from '../storage/dauerhaft';

/**
 * Wenn der Stand nicht mehr gespeichert wird, muss das dastehen.
 *
 * Scheiterte ein Schreibvorgang, fiel die Ablage still auf den
 * Arbeitsspeicher zurück, und von da an war jede Eingabe nur bis zum
 * nächsten Neuladen da. Die App sah dabei aus wie immer: Termine standen im
 * Plan, Häkchen blieben gesetzt, nichts deutete darauf hin, dass all das in
 * einer Stunde weg sein würde. (Aufgefallen beim Nachgehen einer Meldung,
 * die am Ende einen anderen Grund hatte – siehe README, „Wenn der Speicher
 * voll ist".)
 *
 * Deshalb dieser Streifen. Er verschwindet nicht von selbst und er
 * beschönigt nichts – er sagt, dass gerade nichts gespeichert wird, was das
 * heißt, und was dagegen hilft. Wird wieder Platz frei, kommt der nächste
 * Schreibvorgang von selbst an und der Streifen geht ohne Zutun weg.
 *
 * Bewusst *kein* „Schließen". Ein Hinweis, den man wegtippen kann, ist nach
 * dem ersten Mal nicht mehr da – und genau dann wird weiter eingetragen.
 */
export function Speicherwarnung() {
  const lage = useSyncExternalStore(beiAblagewechsel, ablagelage, () => ({
    art: null,
    gescheitert: null,
  }));
  const [platz, setPlatz] = useState<string | null>(null);

  const kaputt = lage.gescheitert !== null;

  useEffect(() => {
    if (!kaputt) {
      setPlatz(null);
      return;
    }
    void speicherplatz().then((p) => setPlatz(p ? platzText(p.benutzt, p.erlaubt) : null));
  }, [kaputt]);

  if (!kaputt) return null;

  return (
    <div className="speicher-warnung" role="alert">
      <div className="fehler-text">
        <strong>Dein Stand wird gerade nicht gespeichert.</strong> Der Browser nimmt keine Daten
        mehr an. Alles, was du ab jetzt eintippst, ist nach einem Neuladen weg.
      </div>
      <div className="fehler-text">
        Der Browser sagt dazu: <code>{lage.gescheitert}</code>
      </div>
      {/*
        Die Zahlen stehen als Messung da, nicht als Begründung. Sie
        unterscheiden die zwei Fälle, die sich sonst gleich anfühlen: Ist
        „belegt" fast so groß wie „erlaubt", ist die Ablage voll. Steht dort
        wenig von viel, liegt es nicht an der Menge – dann ist auf dem Gerät
        selbst kein Platz mehr oder der Browser sperrt die Ablage.
      */}
      {platz && <div className="fehler-text">Belegt sind {platz}.</div>}
      <div className="fehler-text">
        Was hilft: unter <strong>Mehr → Daten</strong> nachsehen, was den Platz belegt – der
        Papierkorb und alte Belegbilder sind die üblichen Verdächtigen. Dort steht auch{' '}
        <strong>Exportieren</strong>; eine Sicherung zu ziehen, solange der Stand noch im
        Arbeitsspeicher liegt, ist der sicherste erste Schritt. Seid ihr im Haushalt verbunden,
        liegen die gemeinsamen Daten ohnehin schon beim anderen.
      </div>
    </div>
  );
}
