/**
 * Aufbereitung eines persönlichen Fotos.
 *
 * Ein Bild direkt aus der Handykamera wiegt mehrere Megabyte. Da es in der
 * geteilten Ablage landet und dort mit jedem Gerät abgeglichen wird, geht es
 * verkleinert und als JPEG hinein: sichtbar identisch, aber ein Bruchteil groß.
 */

/** Längste Kante des abgelegten Bildes. Reicht für Vollbild auf jedem Handy. */
export const PHOTO_MAX_EDGE = 1400;

/** Obergrenze für das Ergebnis; Firestore lässt ein Dokument bis 1 MB zu. */
export const PHOTO_MAX_BYTES = 400_000;

export type PhotoError = 'kein-bild' | 'zu-gross' | 'defekt';

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('defekt'));
    };
    image.src = url;
  });
}

/**
 * Längste Kante eines Belegs.
 *
 * Deutlich mehr als bei einem Porträt: Auf einem Kassenzettel steht Kleingedrucktes,
 * und der Beleg ist nur etwas wert, wenn man die Posten noch lesen kann.
 */
export const RECEIPT_MAX_EDGE = 1800;

/** Auch ein Beleg muss in ein Firestore-Dokument passen. */
export const RECEIPT_MAX_BYTES = 500_000;

/**
 * Verkleinert ein Bild und gibt es als Data-URL zurück.
 * Die Qualität wird so lange gesenkt, bis das Ergebnis unter die Obergrenze
 * passt – lieber etwas weicher als gar nicht gespeichert.
 */
async function prepareImage(
  file: File,
  maxEdge: number,
  maxBytes: number,
  qualities: number[],
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('kein-bild');

  const image = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('defekt');
  context.drawImage(image, 0, 0, width, height);

  for (const quality of qualities) {
    const url = canvas.toDataURL('image/jpeg', quality);
    // Data-URLs sind Base64: rund vier Zeichen je drei Byte.
    if (url.length * 0.75 <= maxBytes) return url;
  }
  throw new Error('zu-gross');
}

/** Ein persönliches Foto für den Startbildschirm. */
export function preparePhoto(file: File): Promise<string> {
  return prepareImage(file, PHOTO_MAX_EDGE, PHOTO_MAX_BYTES, [0.82, 0.7, 0.58, 0.45]);
}

/**
 * Ein fotografierter Beleg.
 *
 * Beginnt bei höherer Qualität als ein Porträt: Bei Text fällt jede
 * Kompressionsstufe sofort auf, ein weicher Himmel dagegen nicht.
 */
export function prepareReceipt(file: File): Promise<string> {
  return prepareImage(file, RECEIPT_MAX_EDGE, RECEIPT_MAX_BYTES, [0.88, 0.78, 0.66, 0.55, 0.42]);
}

export function describePhotoError(error: unknown): string {
  const kind = (error as Error)?.message;
  if (kind === 'kein-bild') return 'Das ist keine Bilddatei.';
  if (kind === 'zu-gross') return 'Dieses Bild lässt sich nicht klein genug rechnen.';
  return 'Das Bild konnte nicht gelesen werden.';
}

/** Grobe Größenangabe einer Data-URL, für die Anzeige in den Einstellungen. */
export function photoSizeKb(dataUrl: string): number {
  return Math.round((dataUrl.length * 0.75) / 1024);
}
