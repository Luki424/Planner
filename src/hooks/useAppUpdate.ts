import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export type AppUpdate = {
  /** Eine neue Fassung liegt bereit und wartet auf Bestätigung. */
  available: boolean;
  /** Die App wurde für den Betrieb ohne Netz eingerichtet. */
  offlineReady: boolean;
  apply: () => void;
  dismiss: () => void;
};

/**
 * Verwaltet den Service Worker.
 *
 * Aktualisiert wird erst auf Zuruf: eine neue Fassung mitten im Einkauf
 * einzuspielen würde die Seite neu laden und die Liste vor der Nase
 * wegziehen.
 */
export function useAppUpdate(): AppUpdate {
  const [available, setAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [apply, setApply] = useState<() => void>(() => () => {});

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => setAvailable(true),
      onOfflineReady: () => setOfflineReady(true),
    });
    // In eine Funktion gewickelt, sonst hielte useState sie für einen Erzeuger.
    setApply(() => () => void update(true));
  }, []);

  return {
    available,
    offlineReady,
    apply,
    dismiss: () => {
      setAvailable(false);
      setOfflineReady(false);
    },
  };
}
