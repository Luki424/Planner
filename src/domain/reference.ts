import { normalizeName } from './prices';

/**
 * Richtwerte für Einkaufspreise.
 *
 * Wozu: Das Preisgedächtnis kennt nur, was ihr schon einmal gekauft habt.
 * Beim ersten „Backpulver" steht die Liste ohne Summe da. Diese Tabelle
 * liefert für solche Fälle einen Anhaltswert, damit die Summe von Anfang an
 * etwas taugt.
 *
 * **Was ein Richtwert ist und was nicht.** Er ist eine Größenordnung für den
 * deutschen Supermarkt, keine Preisauskunft. Er ersetzt nie einen Preis, den
 * ihr selbst eingetragen habt, und er wird auch nicht ins Preisgedächtnis
 * geschrieben – dort steht ausschließlich, was tatsächlich bezahlt wurde.
 * Sobald ihr einen Artikel einmal gekauft habt, ist der Richtwert für ihn
 * bedeutungslos.
 *
 * **Woher die Zahlen stammen.** Es sind Schätzwerte, keine amtliche
 * Statistik – siehe `RICHTWERT_QUELLE`. Sie sind bewusst als Größenordnung
 * angelegt und im Zweifel eher zu niedrig als zu hoch: eine Summe, die
 * überrascht, ist ärgerlicher als eine, die knapp kalkuliert war.
 */

export type Richtwert = {
  /** Wie der Artikel heißt, wenn der Planer ihn nennt. */
  name: string;
  /** Preis in Cent für `menge`. */
  cents: number;
  /** Worauf sich der Preis bezieht, z.B. „1 l" oder „500 g". */
  menge: string;
  /** Weitere Schreibweisen, unter denen der Artikel gefunden wird. */
  auch?: string[];
};

/** Stand der Tabelle – steht in der App, damit niemand alte Zahlen für neu hält. */
export const RICHTWERT_STAND = 'August 2026';

/**
 * Woher die Zahlen kommen – ehrlich benannt.
 *
 * Ursprünglich sollten hier die Durchschnittspreise des Statistischen
 * Bundesamtes stehen. Die ließen sich nicht abrufen, und Zahlen mit einer
 * Quelle zu beschriften, aus der sie nicht stammen, wäre schlimmer als gar
 * keine Quelle. Also steht hier, was es ist.
 */
export const RICHTWERT_QUELLE = 'Schätzwerte für deutsche Supermärkte, keine amtliche Statistik';

/*
 * Rund sechzig Dinge, die in einem Haushalt regelmäßig auf der Liste stehen.
 * Die Namen sind so geschrieben, wie man sie eintippt – Mehrzahl da, wo man
 * die Mehrzahl sagt („Eier", „Kartoffeln", „Nudeln").
 */
const TABELLE: Richtwert[] = [
  // Milch und Molkerei
  { name: 'Milch', cents: 129, menge: '1 l', auch: ['vollmilch', 'frischmilch', 'h-milch'] },
  { name: 'Butter', cents: 229, menge: '250 g' },
  { name: 'Margarine', cents: 179, menge: '500 g' },
  { name: 'Joghurt', cents: 109, menge: '500 g' },
  { name: 'Quark', cents: 119, menge: '500 g' },
  { name: 'Sahne', cents: 99, menge: '200 g', auch: ['schlagsahne'] },
  { name: 'Käse', cents: 269, menge: '200 g', auch: ['gouda', 'emmentaler'] },
  { name: 'Frischkäse', cents: 149, menge: '200 g' },
  { name: 'Eier', cents: 329, menge: '10 Stück' },

  // Brot und Getreide
  { name: 'Brot', cents: 249, menge: '500 g' },
  { name: 'Brötchen', cents: 45, menge: 'Stück', auch: ['semmeln', 'weckle'] },
  { name: 'Toast', cents: 139, menge: '500 g', auch: ['toastbrot'] },
  { name: 'Mehl', cents: 109, menge: '1 kg' },
  { name: 'Nudeln', cents: 129, menge: '500 g', auch: ['spaghetti', 'pasta'] },
  { name: 'Reis', cents: 299, menge: '1 kg' },
  { name: 'Haferflocken', cents: 129, menge: '500 g' },
  { name: 'Müsli', cents: 259, menge: '500 g' },

  // Fleisch und Fisch
  { name: 'Hackfleisch', cents: 549, menge: '500 g', auch: ['hack', 'gehacktes'] },
  { name: 'Hähnchenbrust', cents: 649, menge: '500 g', auch: ['haehnchen', 'hühnchen'] },
  { name: 'Schnitzel', cents: 599, menge: '500 g' },
  { name: 'Aufschnitt', cents: 179, menge: '100 g', auch: ['wurst'] },
  { name: 'Salami', cents: 179, menge: '100 g' },
  { name: 'Schinken', cents: 199, menge: '100 g' },
  { name: 'Lachs', cents: 449, menge: '200 g' },
  { name: 'Thunfisch', cents: 179, menge: 'Dose' },

  // Obst und Gemüse
  { name: 'Kartoffeln', cents: 349, menge: '2,5 kg' },
  { name: 'Zwiebeln', cents: 179, menge: '1 kg' },
  { name: 'Tomaten', cents: 249, menge: '500 g' },
  { name: 'Gurke', cents: 99, menge: 'Stück', auch: ['salatgurke'] },
  { name: 'Paprika', cents: 329, menge: '500 g' },
  { name: 'Salat', cents: 129, menge: 'Kopf', auch: ['kopfsalat'] },
  { name: 'Karotten', cents: 149, menge: '1 kg', auch: ['möhren', 'moehren'] },
  { name: 'Äpfel', cents: 279, menge: '1 kg' },
  { name: 'Bananen', cents: 189, menge: '1 kg' },
  { name: 'Zitronen', cents: 49, menge: 'Stück' },
  { name: 'Champignons', cents: 199, menge: '250 g', auch: ['pilze'] },

  // Vorrat
  { name: 'Zucker', cents: 109, menge: '1 kg' },
  { name: 'Salz', cents: 59, menge: '500 g' },
  { name: 'Öl', cents: 349, menge: '1 l', auch: ['sonnenblumenöl', 'rapsöl', 'speiseöl'] },
  { name: 'Olivenöl', cents: 699, menge: '500 ml' },
  { name: 'Essig', cents: 99, menge: '500 ml' },
  { name: 'Tomatenmark', cents: 89, menge: '200 g' },
  { name: 'Passierte Tomaten', cents: 119, menge: '500 g', auch: ['passata'] },
  { name: 'Kaffee', cents: 799, menge: '500 g' },
  { name: 'Tee', cents: 199, menge: '25 Beutel' },
  { name: 'Honig', cents: 499, menge: '500 g' },
  { name: 'Marmelade', cents: 249, menge: '450 g', auch: ['konfitüre'] },

  // Getränke
  { name: 'Wasser', cents: 289, menge: '6 × 1,5 l', auch: ['mineralwasser', 'sprudel'] },
  { name: 'Saft', cents: 179, menge: '1 l', auch: ['orangensaft', 'apfelsaft'] },
  { name: 'Bier', cents: 1499, menge: 'Kasten' },
  { name: 'Wein', cents: 599, menge: '0,75 l' },
  { name: 'Cola', cents: 149, menge: '1,5 l' },

  // Haushalt
  { name: 'Toilettenpapier', cents: 449, menge: '10 Rollen', auch: ['klopapier'] },
  { name: 'Küchenrolle', cents: 279, menge: '4 Rollen' },
  { name: 'Spülmittel', cents: 129, menge: '500 ml' },
  { name: 'Waschmittel', cents: 449, menge: '20 Wäschen' },
  { name: 'Müllbeutel', cents: 199, menge: 'Packung', auch: ['müllsäcke'] },
  { name: 'Zahnpasta', cents: 179, menge: '75 ml' },
  { name: 'Duschgel', cents: 149, menge: '250 ml' },
  { name: 'Shampoo', cents: 249, menge: '300 ml' },

  // Tiefkühl
  { name: 'Pizza', cents: 299, menge: 'Stück' },
  { name: 'Pommes', cents: 199, menge: '750 g' },
  { name: 'Erbsen', cents: 149, menge: '450 g' },
];

/*
 * Wörter, die vor dem Artikel stehen und nichts über ihn sagen: Mengen,
 * Einheiten, Gebinde. „2 Liter Milch" muss dasselbe finden wie „Milch".
 */
const FUELLWOERTER = new Set([
  'l',
  'liter',
  'ml',
  'kg',
  'g',
  'gramm',
  'pfund',
  'stueck',
  'stk',
  'st',
  'packung',
  'pack',
  'pck',
  'dose',
  'dosen',
  'glas',
  'flasche',
  'flaschen',
  'becher',
  'beutel',
  'tuete',
  'kasten',
  'x',
  'bio',
  'frisch',
]);

/** Ein Schlüssel je Schreibweise, damit die Suche nicht jedes Mal die Tabelle durchgeht. */
const NACH_SCHLUESSEL = new Map<string, Richtwert>();
for (const eintrag of TABELLE) {
  for (const schreibweise of [eintrag.name, ...(eintrag.auch ?? [])]) {
    NACH_SCHLUESSEL.set(normalizeName(schreibweise), eintrag);
  }
}

/**
 * Zerlegt eine Eingabe in die Wörter, die den Artikel benennen.
 *
 * Aus „2 Liter Bio Milch" wird `['milch']` – Zahl, Einheit und „Bio" sagen
 * nichts darüber, *was* gekauft wird.
 */
function artikelwoerter(text: string): string[] {
  return (
    normalizeName(text)
      .split(/[\s,]+/)
      .flatMap((wort) => (wort.includes('-') ? [wort, ...wort.split('-')] : [wort]))
      .filter((wort) => wort && !FUELLWOERTER.has(wort) && !/^[\d.,]+$/.test(wort))
      // „500g" und „1,5l" kommen ohne Leerzeichen daher.
      .filter((wort) => !/^[\d.,]+(l|ml|kg|g|st|stk)$/.test(wort))
  );
}

/**
 * Sucht einen Richtwert zu einem Artikelnamen.
 *
 * Zwei Wege, in dieser Reihenfolge:
 *
 * 1. Ein Wort *ist* der Artikel („Milch", „2 Liter Milch").
 * 2. Ein Wort *endet* auf den Artikel. Im Deutschen steht das Grundwort
 *    hinten: „Vollmilch", „Kaffeesahne", „Salatgurke". Umgekehrt gilt das
 *    nicht – „Milchreis" ist Reis, nicht Milch, und genau das kommt dabei
 *    auch heraus.
 *
 * Bei mehreren Treffern gewinnt das letzte Wort: „Bio Apfel Saft" ist Saft.
 * Findet sich nichts, gibt es `null` – kein Raten.
 */
export function referencePrice(name: string): Richtwert | null {
  const woerter = artikelwoerter(name);
  if (woerter.length === 0) return null;

  let genau: Richtwert | null = null;
  let zusammensetzung: Richtwert | null = null;

  for (const wort of woerter) {
    const treffer = NACH_SCHLUESSEL.get(wort);
    if (treffer) {
      genau = treffer;
      continue;
    }
    for (const [schluessel, eintrag] of NACH_SCHLUESSEL) {
      /*
       * Nur echte Zusammensetzungen: Das Grundwort muss mindestens vier
       * Zeichen haben und noch etwas davorstehen. Sonst fände „Preis" den
       * „Reis" und „Kleie" die „Eier".
       */
      if (
        schluessel.length >= 4 &&
        wort.length > schluessel.length + 1 &&
        wort.endsWith(schluessel)
      )
        zusammensetzung = eintrag;
    }
  }

  return genau ?? zusammensetzung;
}

export type Preisangabe = {
  cents: number;
  /** `eigen`: selbst eingetragen. `richtwert`: geschätzt, nur ein Anhaltswert. */
  herkunft: 'eigen' | 'richtwert';
  /** Worauf sich ein Richtwert bezieht – bei eigenen Preisen leer. */
  menge?: string;
};

/**
 * Welcher Preis gilt für eine Position?
 *
 * Ein selbst eingetragener Preis gewinnt immer. Ein Richtwert springt nur
 * ein, wo gar nichts steht – er soll die Summe brauchbar machen, nicht eine
 * Angabe überschreiben.
 */
export function itemPrice(item: {
  name: string;
  estimatedCents: number | null;
}): Preisangabe | null {
  if (item.estimatedCents !== null) return { cents: item.estimatedCents, herkunft: 'eigen' };
  const richtwert = referencePrice(item.name);
  return richtwert
    ? { cents: richtwert.cents, herkunft: 'richtwert', menge: richtwert.menge }
    : null;
}

export type Einkaufssumme = {
  /** Alles zusammen, eigene Preise und Richtwerte. */
  cents: number;
  /** Wie viel davon nur geschätzt ist. */
  geschaetztCents: number;
  /** Positionen, für die es weder das eine noch das andere gibt. */
  ohnePreis: number;
};

/** Rechnet eine Liste zusammen und sagt dazu, wie viel davon geschätzt ist. */
export function shoppingSum(
  items: Array<{ name: string; estimatedCents: number | null }>,
): Einkaufssumme {
  const out: Einkaufssumme = { cents: 0, geschaetztCents: 0, ohnePreis: 0 };
  for (const item of items) {
    const preis = itemPrice(item);
    if (!preis) {
      out.ohnePreis += 1;
      continue;
    }
    out.cents += preis.cents;
    if (preis.herkunft === 'richtwert') out.geschaetztCents += preis.cents;
  }
  return out;
}
