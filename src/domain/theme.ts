/**
 * Helles oder dunkles Erscheinungsbild.
 *
 * Drei Zustände, nicht zwei: „Wie das Gerät" ist die Voreinstellung und
 * bleibt sie auch – ein Handy, das abends von selbst dunkel wird, soll den
 * Planer mitnehmen. Wer sich festlegen will, wählt hell oder dunkel.
 *
 * Die Wahl liegt bewusst nur auf dem Gerät und nicht bei den geteilten
 * Einstellungen: Lukas' Handy darf dunkel sein, während Svenjas hell ist.
 * Ein Erscheinungsbild ist nichts, worüber sich ein Haushalt einigen muss.
 */

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

export const THEME_KEY = 'planner:theme';

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: 'Wie das Gerät',
  light: 'Hell',
  dark: 'Dunkel',
};

/** Farbe der Systemleiste je Erscheinungsbild – muss zu --bg passen. */
export const THEME_COLORS: Record<ThemeMode, string> = {
  dark: '#171814',
  light: '#f4f1e9',
};

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Gespeicherte Wahl; alles Unbekannte gilt als „wie das Gerät". */
export function readThemeChoice(): ThemeChoice {
  try {
    const gespeichert = localStorage.getItem(THEME_KEY);
    return isThemeChoice(gespeichert) ? gespeichert : 'system';
  } catch {
    // Privater Modus ohne Speicher – dann eben die Systemvorgabe.
    return 'system';
  }
}

export function writeThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Ohne Speicher gilt die Wahl nur für diese Sitzung.
  }
}

/** Was tatsächlich angezeigt wird. */
export function resolveTheme(choice: ThemeChoice, systemPrefersLight: boolean): ThemeMode {
  if (choice !== 'system') return choice;
  return systemPrefersLight ? 'light' : 'dark';
}

/**
 * Beim Tippen auf den Umschalter: immer zum Gegenteil des Sichtbaren.
 *
 * Aus „wie das Gerät" wird dadurch eine feste Wahl – das ist gewollt, denn
 * wer tippt, will jetzt etwas anderes sehen. Zurück zur Systemvorgabe geht
 * es über die Einstellungen.
 */
export function nextChoice(current: ThemeChoice, systemPrefersLight: boolean): ThemeChoice {
  return resolveTheme(current, systemPrefersLight) === 'dark' ? 'light' : 'dark';
}

/**
 * Trägt die Wahl an der Wurzel ein.
 *
 * Bei „wie das Gerät" wird das Attribut entfernt, statt einen Wert zu setzen:
 * dann greift wieder die Abfrage der Systemeinstellung im Stylesheet.
 */
export function applyTheme(choice: ThemeChoice, root: HTMLElement, mode: ThemeMode): void {
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);

  // Die Systemleiste am Handy soll dieselbe Farbe tragen wie der Hintergrund.
  for (const el of document.querySelectorAll('meta[name="theme-color"]')) {
    el.setAttribute('content', THEME_COLORS[mode]);
    el.removeAttribute('media');
  }
}
