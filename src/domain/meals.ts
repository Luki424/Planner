import { normalizeName, recallPrice } from './prices';
import type {
  MealEntry,
  MealSlot,
  PriceMemoryEntry,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
} from './types';

/**
 * Essensplanung: aus geplanten Gerichten wird eine Einkaufsliste.
 *
 * Der Nutzen entsteht erst beim Zusammenfassen. Wer für die Woche vier
 * Gerichte plant, will nicht viermal "Zwiebeln" auf der Liste haben, sondern
 * einmal die Summe – und den Preis, den die Liste ohnehin schon kennt.
 */

export const SLOT_LABELS: Record<MealSlot, string> = {
  mittag: 'Mittag',
  abend: 'Abend',
};

export const SLOTS: MealSlot[] = ['mittag', 'abend'];

/**
 * Rechnet eine Menge auf eine andere Personenzahl um.
 *
 * Gerundet wird auf zwei Nachkommastellen: "0,67 kg Hackfleisch" ist eine
 * Angabe, mit der man einkaufen kann, 0,6666666 nicht.
 */
export function scaleQuantity(
  quantity: number | null,
  fromServings: number,
  toServings: number,
): number | null {
  if (quantity === null) return null;
  if (fromServings <= 0) return quantity;
  const scaled = (quantity * toServings) / fromServings;
  return Math.round(scaled * 100) / 100;
}

export type NeededItem = {
  /** Anzeigename, wie er zuerst vorkam. */
  name: string;
  quantity: number | null;
  unit: string;
  /** Aus welchen Gerichten die Menge stammt – erklärt die Summe. */
  from: string[];
  estimatedCents: number | null;
  /** Steht schon offen auf der Einkaufsliste. */
  alreadyListed: boolean;
};

/**
 * Zutaten unter einem Schlüssel zusammenfassen.
 *
 * Der Schlüssel ist der vereinheitlichte Name plus die Einheit: "500 g Mehl"
 * und "2 Packungen Mehl" lassen sich nicht addieren, "300 g Mehl" und
 * "200 g Mehl" schon.
 */
function keyOf(name: string, unit: string): string {
  return `${normalizeName(name)}|${unit.trim().toLowerCase()}`;
}

export type CollectOptions = {
  entries: MealEntry[];
  recipes: Recipe[];
  ingredients: RecipeIngredient[];
  /** Was offen auf der Einkaufsliste steht – wird markiert, nicht verschwiegen. */
  shopping: ShoppingItem[];
  priceMemory: Record<string, PriceMemoryEntry>;
  /** Vorräte wie Salz und Öl mitnehmen? Voreinstellung: nein. */
  includeStaples?: boolean;
};

export type CollectResult = {
  items: NeededItem[];
  /** Wie viele Vorratszutaten ausgelassen wurden. */
  staplesSkipped: number;
  /** Geplante Gerichte ohne hinterlegtes Rezept ("Essen gehen"). */
  withoutRecipe: number;
};

/** Stellt zusammen, was für die geplanten Gerichte fehlt. */
export function collectNeeded({
  entries,
  recipes,
  ingredients,
  shopping,
  priceMemory,
  includeStaples = false,
}: CollectOptions): CollectResult {
  const offen = new Set(
    shopping.filter((item) => !item.done).map((item) => normalizeName(item.name)),
  );

  const gesammelt = new Map<string, NeededItem>();
  let staplesSkipped = 0;
  let withoutRecipe = 0;

  for (const entry of entries) {
    if (!entry.recipeId) {
      withoutRecipe += 1;
      continue;
    }
    const recipe = recipes.find((r) => r.id === entry.recipeId);
    if (!recipe) {
      withoutRecipe += 1;
      continue;
    }

    for (const zutat of ingredients.filter((i) => i.recipeId === recipe.id)) {
      if (zutat.staple && !includeStaples) {
        staplesSkipped += 1;
        continue;
      }
      const menge = scaleQuantity(zutat.quantity, recipe.servings, entry.servings);
      const key = keyOf(zutat.name, zutat.unit);
      const vorhanden = gesammelt.get(key);

      if (vorhanden) {
        // Ohne Menge bleibt es ohne Menge: "etwas Petersilie" plus "etwas
        // Petersilie" ergibt keine Zahl, sondern weiterhin "etwas".
        vorhanden.quantity =
          vorhanden.quantity === null || menge === null
            ? null
            : Math.round((vorhanden.quantity + menge) * 100) / 100;
        if (!vorhanden.from.includes(recipe.title)) vorhanden.from.push(recipe.title);
        continue;
      }

      gesammelt.set(key, {
        name: zutat.name.trim(),
        quantity: menge,
        unit: zutat.unit.trim(),
        from: [recipe.title],
        estimatedCents: recallPrice(priceMemory, zutat.name),
        alreadyListed: offen.has(normalizeName(zutat.name)),
      });
    }
  }

  const items = [...gesammelt.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return { items, staplesSkipped, withoutRecipe };
}

/** Was ein Gericht im Plan überschrieben anzeigt. */
export function mealLabel(entry: MealEntry, recipes: Recipe[]): string {
  if (entry.recipeId) {
    const recipe = recipes.find((r) => r.id === entry.recipeId);
    if (recipe) return recipe.title;
  }
  return entry.title || 'Noch offen';
}

/** Zutaten eines Rezepts, in der Reihenfolge ihrer Anlage. */
export function ingredientsOf(recipeId: string, ingredients: RecipeIngredient[]): RecipeIngredient[] {
  return ingredients.filter((i) => i.recipeId === recipeId);
}

/**
 * Formatiert eine Menge für die Anzeige. Ganze Zahlen ohne Nachkomma,
 * gebrochene mit Komma – "1,5 kg" liest sich besser als "1.5 kg".
 */
export function formatQuantity(quantity: number | null, unit: string): string {
  if (quantity === null) return unit.trim();
  const zahl = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  return unit.trim() ? `${zahl} ${unit.trim()}` : zahl;
}
