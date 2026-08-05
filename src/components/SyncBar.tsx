import type { SyncApi } from '../sync/useSync';

const LABEL: Record<SyncApi['status'], string> = {
  unconfigured: 'nur auf diesem Gerät',
  'signed-out': 'nicht angemeldet',
  connecting: 'verbinde …',
  'no-household': 'kein Haushalt',
  live: 'synchron',
  error: 'Sync-Fehler',
};

const TONE: Record<SyncApi['status'], string> = {
  unconfigured: 'off',
  'signed-out': 'warn',
  connecting: 'busy',
  'no-household': 'warn',
  live: 'ok',
  error: 'bad',
};

/** Zeigt in einem Blick, ob die Daten geteilt werden oder nur lokal liegen. */
export function SyncBar({ sync, compact }: { sync: SyncApi; compact: boolean }) {
  // Auf schmalen Schirmen bleibt nur ein Punkt übrig – der sagt ohne Text
  // nichts und sähe wie ein Schalter aus. Solange nichts geteilt wird, weg damit.
  if (compact && sync.status === 'unconfigured') return null;

  return (
    <span className={`sync-pill ${TONE[sync.status]}`} title={syncTitle(sync)}>
      <span className="sync-dot" aria-hidden />
      {!compact && LABEL[sync.status]}
      {!compact && sync.status === 'live' && sync.members > 1 && (
        <span className="muted small"> · {sync.members} Personen</span>
      )}
    </span>
  );
}

function syncTitle(sync: SyncApi): string {
  switch (sync.status) {
    case 'live':
      return `Angemeldet als ${sync.email}. Haushalt ${sync.householdId} mit ${sync.members} ${
        sync.members === 1 ? 'Person' : 'Personen'
      }.`;
    case 'unconfigured':
      return 'Die Daten liegen nur in diesem Browser. Unter Einstellungen lässt sich das Teilen einrichten.';
    case 'signed-out':
      return 'Firebase ist eingerichtet, du bist aber nicht angemeldet.';
    case 'no-household':
      return 'Angemeldet, aber noch keinem Haushalt zugeordnet.';
    case 'error':
      return sync.message ?? 'Die Synchronisation meldet einen Fehler.';
    default:
      return 'Verbindung wird aufgebaut …';
  }
}
