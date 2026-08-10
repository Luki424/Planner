import { useEffect, useState } from 'react';

/**
 * Der Ausschnitt, den man wirklich sieht.
 *
 * `position: fixed` hängt am *Layout*-Viewport. Zoomt jemand am Handy hinein,
 * schrumpft der sichtbare Ausschnitt und wandert – das feste Element bleibt
 * aber, wo es war, und rutscht aus dem Bild. Genau deshalb war beim
 * Diktieren im Zoom nicht mehr zu sehen, ob etwas angekommen ist.
 *
 * `visualViewport` beschreibt den sichtbaren Ausschnitt. Wer sich daran
 * ausrichtet, bleibt im Bild – auch beim Zoomen, beim Scrollen im Zoom und
 * wenn die Bildschirmtastatur aufgeht.
 */
export type Sichtfeld = {
  /** Versatz des sichtbaren Ausschnitts gegenüber dem Layout-Viewport. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** 1 heißt: nicht gezoomt. */
  scale: number;
};

function lesen(): Sichtfeld {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) {
    const w = typeof window === 'undefined' ? 0 : window.innerWidth;
    const h = typeof window === 'undefined' ? 0 : window.innerHeight;
    return { left: 0, top: 0, width: w, height: h, scale: 1 };
  }
  return {
    left: vv.offsetLeft,
    top: vv.offsetTop,
    width: vv.width,
    height: vv.height,
    scale: vv.scale,
  };
}

const gleich = (a: Sichtfeld, b: Sichtfeld) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

export function useVisualViewport(aktiv = true): Sichtfeld {
  const [feld, setFeld] = useState<Sichtfeld>(lesen);

  useEffect(() => {
    if (!aktiv) return;
    const vv = window.visualViewport;
    if (!vv) return;
    // Nur bei echter Änderung neu rendern – beim Zoomen feuert das Ereignis
    // in schneller Folge.
    const aktualisieren = () => setFeld((alt) => (gleich(alt, lesen()) ? alt : lesen()));
    aktualisieren();
    vv.addEventListener('resize', aktualisieren);
    vv.addEventListener('scroll', aktualisieren);
    return () => {
      vv.removeEventListener('resize', aktualisieren);
      vv.removeEventListener('scroll', aktualisieren);
    };
  }, [aktiv]);

  return feld;
}

/**
 * Stil für ein Feld, das unten im sichtbaren Ausschnitt kleben soll.
 *
 * `abstand` ist der Rand ringsum. Gerechnet wird in Layout-Pixeln – genau
 * darin sind `position: fixed` und `visualViewport` angegeben. Ein
 * Ausgleich für den Zoom wäre falsch: Wer hineingezoomt hat, will alles
 * größer sehen, das Rückmeldefeld eingeschlossen.
 *
 * Die Höhe ist gedeckelt: Im Zoom bleibt vom Bildschirm wenig übrig, und
 * ein Feld, dessen Knöpfe unten herausragen, hilft niemandem.
 */
/**
 * Stil für etwas, das unten rechts im sichtbaren Ausschnitt kleben soll.
 *
 * Aus demselben Grund wie `amUnterenRand`, aber für die Ecke: Ein festes
 * `bottom: 72px` misst vom Layout-Rand. Geht am Handy die Tastatur auf,
 * liegt dieser Rand hinter der Tastatur – und die Blase mit ihm.
 */
export function inDerEckeUntenRechts(
  feld: Sichtfeld,
  abstandUnten: number,
  abstandRechts: number,
): React.CSSProperties {
  return {
    position: 'fixed',
    left: feld.left + feld.width - abstandRechts,
    top: feld.top + feld.height - abstandUnten,
    right: 'auto',
    bottom: 'auto',
    transform: 'translate(-100%, -100%)',
  };
}

export function amUnterenRand(
  feld: Sichtfeld,
  abstand: number,
  /*
   * Der seitliche Rand, falls er nicht dem unteren entsprechen soll.
   *
   * Der untere Abstand hält Navigationsleiste und Blase frei und ist
   * deshalb groß. Denselben Wert seitlich zu nehmen, macht das Feld unnötig
   * schmal: Bei 84 px blieben von 412 nur 244 übrig, und „In 10 Minuten:
   * Zahnarzt Dr. Berger" stand vierzeilig als Säule da.
   */
  seitlich = abstand,
): React.CSSProperties {
  return {
    position: 'fixed',
    left: feld.left + feld.width / 2,
    top: feld.top + feld.height - abstand,
    transform: 'translate(-50%, -100%)',
    width: Math.max(0, feld.width - 2 * seitlich),
    maxWidth: 'none',
    maxHeight: Math.max(0, feld.height - abstand - seitlich),
    overflowY: 'auto',
  };
}
