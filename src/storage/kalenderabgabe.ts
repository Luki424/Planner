/**
 * Die Kalenderdatei aus dem Browser heraus weiterreichen.
 *
 * Zwei Wege, in dieser Reihenfolge:
 *
 * 1. **Der Teilen-Dialog des Geräts.** Am Handy der bessere: Android bietet
 *    dort den Kalender direkt an, der Termin landet mit zwei Tipps drin.
 * 2. **Herunterladen.** Überall sonst – und auch dann, wenn der Teilen-
 *    Dialog Dateien nicht annimmt. Eine `.ics` im Download-Ordner öffnet der
 *    Kalender ebenfalls, nur mit einem Schritt mehr.
 *
 * Kein stiller Fehlschlag: Wer tippt und nichts passiert, probiert es
 * dreimal und hält die App für kaputt. Deshalb sagt die Rückgabe, welcher
 * Weg genommen wurde.
 */

export type Abgabeweg = 'geteilt' | 'geladen' | 'abgebrochen';

type TeilenFaehig = Navigator & {
  canShare?: (daten: { files?: File[] }) => boolean;
  share?: (daten: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

export async function geheAnKalender(ics: string, name: string, titel: string): Promise<Abgabeweg> {
  const datei = new File([ics], name, { type: 'text/calendar' });
  const nav = typeof navigator === 'undefined' ? null : (navigator as TeilenFaehig);

  if (nav?.share && nav.canShare?.({ files: [datei] })) {
    try {
      await nav.share({ files: [datei], title: titel });
      return 'geteilt';
    } catch (err) {
      /*
       * Ein Abbruch ist kein Fehler – der Benutzer hat den Dialog
       * weggewischt. Nur dann still bleiben; bei allem anderen wird
       * heruntergeladen, statt aufzugeben.
       */
      if (err instanceof DOMException && err.name === 'AbortError') return 'abgebrochen';
    }
  }

  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Erst freigeben, wenn der Browser die Datei geholt hat.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'geladen';
}
