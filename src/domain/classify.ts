/**
 * Beruflich oder privat? Eine Einschätzung für eingelesene Kalendertermine.
 *
 * Der Zweck ist eng gefasst: Ein eingelesener Kalender ist fast immer
 * *einer* von beidem – ein Arbeitskalender mit ein paar privaten Terminen
 * darin, oder umgekehrt. Deshalb entscheidet nicht diese Datei, wohin die
 * Masse geht, sondern der Benutzer beim Import. Hier werden nur die
 * Ausnahmen erkannt.
 *
 * Daraus folgt die Leitlinie: **lieber nichts sagen als falsch raten.**
 * Wer unsicher ist, gibt `null` zurück und landet in der gewählten Vorgabe.
 * Ein falsch einsortierter Termin ist schlimmer als ein nicht einsortierter,
 * weil man ihn nicht dort sucht, wo er liegt.
 */

export type Bereichsart = 'beruflich' | 'privat';

/*
 * Wörter, die im Deutschen fast nur privat vorkommen. Bewusst konkret:
 * „Arzt" ja, „Termin" nein. Jedes Wort hier muss die Frage bestehen:
 * Könnte das in einem Arbeitskalender stehen und dort etwas anderes
 * bedeuten? Wenn ja, gehört es nicht in die Liste.
 */
const PRIVAT = [
  // Gesundheit
  'arzt',
  'ärztin',
  'zahnarzt',
  'doktor',
  'praxis',
  'klinik',
  'krankenhaus',
  'impfen',
  'impfung',
  'physio',
  'therapie',
  'vorsorge',
  'blutabnahme',
  // Familie und Feiern
  'geburtstag',
  'hochzeit',
  'taufe',
  'beerdigung',
  'jubiläum',
  'standesamt',
  'familie',
  'oma',
  'opa',
  'schwiegereltern',
  'elternabend',
  'kita',
  'kindergarten',
  'einschulung',
  'elternsprechtag',
  // Reisen und Freizeit
  'urlaub',
  'ferien',
  'kreuzfahrt',
  'kruzfahrt',
  'wochenende',
  'ausflug',
  'kino',
  'konzert',
  'theater',
  'museum',
  'schwimmbad',
  'sauna',
  'wandern',
  'golfclub',
  'fitness',
  'sportverein',
  // Haus und Alltag
  'friseur',
  'frisör',
  'werkstatt',
  'hauptuntersuchung',
  'zulassungsstelle',
  'schornsteinfeger',
  'handwerker',
  'installateur',
  'zählertausch',
  'umzug',
  'möbel',
  'einkaufen',
  'geschenk',
  // Ämter und Persönliches
  'notar',
  'konsulat',
  'botschaft',
  'bürgeramt',
  'einwohnermeldeamt',
  'privat',
  'privater termin',
];

/*
 * Wörter, die auf Arbeit hindeuten. Kürzer und vorsichtiger: In einem
 * privaten Kalender stehen selten „Besprechungen", aber ein „Update" oder
 * ein „Termin" sagt gar nichts.
 */
const BERUFLICH = [
  'besprechung',
  'meeting',
  'jour fixe',
  'kick-off',
  'kick off',
  'kickoff',
  'abstimmung',
  'absprache',
  'telefonkonferenz',
  'telko',
  'videokonferenz',
  'workshop',
  'seminar',
  'schulung',
  'lehrgang',
  'fortbildung',
  'konferenz',
  'tagung',
  'messe',
  'kundentermin',
  'angebot',
  'ausschreibung',
  'vorstellungsgespräch',
  'bewerbungsgespräch',
  'mitarbeitergespräch',
  'betriebsversammlung',
  'inventur',
  'bereitschaft',
  'dienstreise',
  'projekt',
  'review',
  'quartalsgespräch',
  'jahresgespräch',
];

/*
 * Grundwörter, die auch mitten in einer Zusammensetzung zählen.
 *
 * Im Deutschen steht das Grundwort hinten: „Überraschungs-ausflug",
 * „Sommer-urlaub", „Kinder-geburtstag". Die Suche am Wortanfang findet das
 * nicht. Diese Liste ist bewusst kurz und ausdrücklich – eine Faustregel
 * über die Wortlänge holte sich sofort „Verkaufs-training" als privat
 * zurück, und „training" ist deshalb ganz herausgeflogen.
 */
const KOMPOSITA = [
  'ausflug',
  'geburtstag',
  'hochzeit',
  'urlaub',
  'kreuzfahrt',
  'konzert',
  'feier',
  'arzt',
];

function normalisieren(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Trifft eines der Wörter?
 *
 * Am Wortanfang, nicht irgendwo mitten drin. Eine reine Teilwortsuche
 * ergab „Th**oma**s Behringer" = privat (wegen „oma") und „C**oP** KBA
 * Besprechung" = privat (wegen „op"). Am Wortanfang bleibt dagegen die
 * deutsche Zusammensetzung erhalten: „Zahnarzttermin" trifft „zahnarzt",
 * „Geburtstagsfeier" trifft „geburtstag".
 *
 * Mehrwortbegriffe wie „jour fixe" werden als Wortfolge gesucht.
 */
function trifft(text: string, woerter: string[]): boolean {
  /*
   * Ein Bindestrich verbindet zwei Wörter zu einem Token: „Team-Besprechung"
   * beginnt nicht mit „besprechung". Deshalb zählen auch die Teile hinter
   * dem Bindestrich als Wortanfang. Das ganze Token bleibt daneben stehen,
   * damit Stichwörter mit Bindestrich wie „kick-off" weiter treffen.
   */
  const teile = text
    .split(' ')
    .flatMap((wort) => (wort.includes('-') ? [wort, ...wort.split('-')] : [wort]))
    .filter(Boolean);
  return woerter.some((wort) => {
    if (wort.includes(' ')) return ` ${text} `.includes(` ${wort}`);
    if (KOMPOSITA.includes(wort)) return text.includes(wort);
    return teile.some((t) => t.startsWith(wort));
  });
}

/**
 * Schätzt ein, ob ein Termin privat oder beruflich ist.
 *
 * `null` heißt „weiß ich nicht" – der Aufrufer setzt dann seine Vorgabe ein.
 * Treffen beide Listen, gewinnt „privat": eine Kreuzfahrt mit dem Wort
 * „Meeting" im Beschreibungstext ist eher eine Kreuzfahrt.
 */
export function classifyEvent(title: string, location = '', description = ''): Bereichsart | null {
  /*
   * Nur Titel und Ort werden gewertet. Der Beschreibungstext einer
   * Einladung enthält oft ganze E-Mail-Verläufe – darin findet sich
   * irgendein Wort immer, und die Einschätzung wäre nur noch Zufall.
   */
  void description;
  const text = normalisieren(`${title} ${location}`);
  if (!text) return null;

  const privat = trifft(text, PRIVAT);
  const beruflich = trifft(text, BERUFLICH);

  if (privat) return 'privat';
  if (beruflich) return 'beruflich';
  return null;
}

export type Einschaetzung = { privat: number; beruflich: number; unklar: number };

/** Zählt, wie eine Menge Termine ausfallen würde – für die Vorschau. */
export function summarizeClassification(
  events: Array<{ title: string; location?: string }>,
): Einschaetzung {
  const out: Einschaetzung = { privat: 0, beruflich: 0, unklar: 0 };
  for (const e of events) {
    const art = classifyEvent(e.title, e.location ?? '');
    if (art === 'privat') out.privat += 1;
    else if (art === 'beruflich') out.beruflich += 1;
    else out.unklar += 1;
  }
  return out;
}
