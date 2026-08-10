import type { Vorschlag } from './assistant';

/**
 * Was vorgelesen wird – und in welchen Stücken.
 *
 * Keine Sprachausgabe hier drin, nur Text. Deshalb ohne Browser prüfbar,
 * und das ist bei einer Funktion, die man nicht sehen kann, das einzige
 * Mittel: Fehler in der Sprachausgabe hört man nur, wenn man zufällig
 * zuhört.
 */

/**
 * Der Text zu einer Antwort, so wie man ihn hören will.
 *
 * Die Vorschläge gehören dazu. Wer freihändig fragt, sieht nicht hin – und
 * „ich kann zwei Sachen eintragen" ohne zu sagen welche, wäre die Hälfte
 * einer Antwort. Der Fingertipp bleibt trotzdem nötig; nur weiß man dann,
 * wofür.
 */
export function vorleseText(text: string, vorschlaege: Vorschlag[] = []): string {
  const teile = [text.trim()].filter(Boolean);
  for (const v of vorschlaege) teile.push(`${v.text}.`);
  if (vorschlaege.length === 1) teile.push('Zum Eintragen auf Übernehmen tippen.');
  else if (vorschlaege.length > 1) teile.push('Zum Eintragen jeweils auf Übernehmen tippen.');
  return teile.join(' ');
}

const HAPPEN_MAX = 180;

/**
 * Zerlegt einen Text in Stücke, die eine Sprachausgabe am Stück schafft.
 *
 * Chrome bricht eine lange Äußerung nach etwa fünfzehn Sekunden mitten im
 * Wort ab – ein bekannter Fehler, kein Missverständnis unsererseits.
 * Getrennt wird deshalb an Satzenden; nur wenn ein einzelner Satz zu lang
 * ist, wird an einer Wortgrenze geschnitten. Mitten im Wort zu trennen
 * klänge schlimmer als jeder Abbruch.
 */
export function inHappen(text: string, max = HAPPEN_MAX): string[] {
  const sauber = text.replace(/\s+/g, ' ').trim();
  if (!sauber) return [];

  // Satzenden behalten ihr Zeichen – die Sprachausgabe braucht es für die Melodie.
  const saetze = sauber.match(/[^.!?]+[.!?]*\s*/g) ?? [sauber];

  const happen: string[] = [];
  let laufend = '';
  const ablegen = () => {
    const fertig = laufend.trim();
    if (fertig) happen.push(fertig);
    laufend = '';
  };

  for (const satz of saetze) {
    if (satz.trim().length > max) {
      ablegen();
      for (const stueck of anWortgrenzen(satz.trim(), max)) happen.push(stueck);
      continue;
    }
    if ((laufend + satz).trim().length > max) ablegen();
    laufend += satz;
  }
  ablegen();
  return happen;
}

function anWortgrenzen(satz: string, max: number): string[] {
  const raus: string[] = [];
  let laufend = '';
  for (const wort of satz.split(' ')) {
    if (laufend && (laufend + ' ' + wort).length > max) {
      raus.push(laufend);
      laufend = wort;
    } else {
      laufend = laufend ? `${laufend} ${wort}` : wort;
    }
  }
  if (laufend) raus.push(laufend);
  return raus;
}
