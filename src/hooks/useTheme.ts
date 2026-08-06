import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  readThemeChoice,
  resolveTheme,
  writeThemeChoice,
  type ThemeChoice,
  type ThemeMode,
} from '../domain/theme';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

/**
 * Erscheinungsbild wählen und anwenden.
 *
 * Hört bei „wie das Gerät" auf die Systemeinstellung, damit ein Wechsel am
 * Abend sofort ankommt, ohne dass die Seite neu geladen werden muss.
 */
export function useTheme(): {
  choice: ThemeChoice;
  mode: ThemeMode;
  setChoice: (next: ThemeChoice) => void;
} {
  const [choice, setChoiceState] = useState<ThemeChoice>(readThemeChoice);
  const [systemLight, setSystemLight] = useState(
    () => typeof matchMedia === 'function' && matchMedia(LIGHT_QUERY).matches,
  );

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(LIGHT_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemLight(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const mode = resolveTheme(choice, systemLight);

  useEffect(() => {
    applyTheme(choice, document.documentElement, mode);
  }, [choice, mode]);

  const setChoice = useCallback((next: ThemeChoice) => {
    writeThemeChoice(next);
    setChoiceState(next);
  }, []);

  return { choice, mode, setChoice };
}
