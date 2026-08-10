/**
 * Das Weckwort.
 *
 * Reine Texterkennung, kein Mikrofon – deshalb ohne Browser prüfbar. Und
 * das ist hier besonders wichtig: Ein Weckwort, das zu leicht anspringt,
 * öffnet den Assistenten beim Abendessen; eines, das zu streng ist, tut
 * nie etwas. Beides merkt man erst im Betrieb, wenn man es nicht prüft.
 */

/*
 * Mehrere Anreden, weil die Erkennung „Planer" gern verhört – als „Planner",
 * „Plana", „Planet". Lieber ein paar Schreibweisen zu viel als ein Weckwort,
 * das bei jedem Dritten nicht anspringt.
 */
const ANREDE = '(?:planer|planner|plana|planet|planta)';
const GRUSS = '(?:hey|hei|hallo|halo|ok|okay|okey|he)';

const WECKWORT = new RegExp(`^\\s*${GRUSS}[\\s,]+${ANREDE}\\b[\\s,.!?]*`, 'i');

/** Springt nur am Satzanfang an – „ein guter Planer" weckt nichts. */
export function istWeckwort(text: string): boolean {
  return WECKWORT.test(normalisiere(text));
}

/**
 * Was nach dem Weckwort noch gesagt wurde.
 *
 * „Hey Planer, was steht Donnerstag an" soll nicht nur öffnen, sondern
 * gleich fragen – wer den Satz schon gesagt hat, will ihn nicht wiederholen.
 * Bleibt nichts übrig, ist das Ergebnis leer und der Assistent geht nur auf.
 */
export function ohneWeckwort(text: string): string {
  const roh = normalisiere(text);
  if (!WECKWORT.test(roh)) return roh.trim();
  return roh.replace(WECKWORT, '').trim();
}

function normalisiere(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
