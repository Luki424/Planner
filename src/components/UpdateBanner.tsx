import type { AppUpdate } from '../hooks/useAppUpdate';

/** Hinweisleiste am unteren Rand: neue Fassung verfügbar oder offline bereit. */
export function UpdateBanner({ update }: { update: AppUpdate }) {
  if (!update.available && !update.offlineReady) return null;

  return (
    <div className="update-banner" role="status">
      {update.available ? (
        <>
          <span>Eine neue Fassung des Planers steht bereit.</span>
          <button className="btn ghost tiny" onClick={update.dismiss}>
            Später
          </button>
          <button className="btn primary tiny" onClick={update.apply}>
            Jetzt laden
          </button>
        </>
      ) : (
        <>
          <span>Der Planer funktioniert jetzt auch ohne Netz.</span>
          <button className="btn ghost tiny" onClick={update.dismiss}>
            Alles klar
          </button>
        </>
      )}
    </div>
  );
}
