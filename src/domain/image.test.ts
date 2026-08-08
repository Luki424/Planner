import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  RECEIPT_MAX_BYTES,
  RECEIPT_MAX_EDGE,
  describePhotoError,
  photoSizeKb,
} from './image';

/*
 * Die Aufbereitung selbst braucht Canvas und läuft im Browserdurchlauf.
 * Hier stehen die Grenzen – sie sind die eigentliche Aussage der Datei und
 * lassen sich still verstellen, ohne dass etwas sichtbar kaputtgeht.
 */

describe('Grenzen für Bilder', () => {
  it('hält jedes Bild unter dem Firestore-Limit', () => {
    /*
     * Ein Firestore-Dokument darf 1 MB groß sein. Eine Data-URL ist Base64
     * und wächst um ein Drittel – die Obergrenze muss deshalb deutlich
     * darunter liegen, sonst wird der Abgleich still abgelehnt.
     */
    const LIMIT = 1_048_576;
    for (const bytes of [PHOTO_MAX_BYTES, RECEIPT_MAX_BYTES]) {
      assert.ok(bytes * 1.34 < LIMIT, `${bytes} Byte werden als Base64 zu groß`);
    }
  });

  it('gibt einem Beleg mehr Auflösung als einem Porträt', () => {
    // Auf einem Kassenbon steht Kleingedrucktes; ein Gesicht verträgt weniger.
    assert.ok(RECEIPT_MAX_EDGE > PHOTO_MAX_EDGE);
  });

  it('rechnet die Größe einer Data-URL', () => {
    // Vier Base64-Zeichen tragen drei Byte.
    assert.equal(photoSizeKb('x'.repeat(4096)), 3);
  });
});

describe('Fehlermeldungen', () => {
  it('sagt, was schiefging', () => {
    assert.match(describePhotoError(new Error('kein-bild')), /keine Bilddatei/);
    assert.match(describePhotoError(new Error('zu-gross')), /klein genug/);
    assert.match(describePhotoError(new Error('defekt')), /nicht gelesen/);
  });

  it('bleibt auch bei Unbekanntem verständlich', () => {
    // Kein "undefined" und kein Stacktrace vor den Augen des Benutzers.
    assert.match(describePhotoError(null), /nicht gelesen/);
    assert.match(describePhotoError('irgendwas'), /nicht gelesen/);
  });
});
