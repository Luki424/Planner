import { createContext, useContext } from 'react';
import type { ID } from '../domain/types';

/**
 * Ziehen und Ablegen auf Pointer-Events statt auf der HTML5-Drag-API.
 *
 * Die HTML5-Variante kennt kein Touch – auf dem Handy ließe sich damit nichts
 * verschieben. Pointer-Events behandeln Maus, Stift und Finger gleich.
 *
 * Damit eine Berührung nicht gleichzeitig die Seite scrollt, hängt das Ziehen
 * an einer eigenen Anfassfläche mit `touch-action: none`; der Rest einer Karte
 * bleibt normal scroll- und antippbar.
 */

export type DragPayload =
  | { kind: 'task'; taskId: ID; label: string; durationMin: number }
  | { kind: 'block'; blockId: ID; label: string; durationMin: number; grabOffsetMin: number };

export type DropTarget =
  | { kind: 'timeline'; date: string; startMin: number }
  | { kind: 'day'; date: string }
  | { kind: 'pool' };

export type DragState = {
  payload: DragPayload;
  x: number;
  y: number;
  target: DropTarget | null;
};

type DragContextValue = {
  state: DragState | null;
  startDrag: (payload: DragPayload, event: React.PointerEvent) => void;
};

export const DragContext = createContext<DragContextValue | null>(null);

/** Wie nah am Rand einer Zeitachse das automatische Weiterscrollen einsetzt. */
const EDGE_ZONE_PX = 64;
const EDGE_SPEED_PX = 12;

function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Sucht unter dem Zeiger das nächstgelegene Ablageziel. */
export function resolveTarget(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  const zone = element?.closest<HTMLElement>('[data-drop]');
  if (!zone) return null;

  const kind = zone.dataset.drop;
  if (kind === 'pool') return { kind: 'pool' };
  if (kind === 'day' && zone.dataset.date) return { kind: 'day', date: zone.dataset.date };
  if (kind === 'timeline' && zone.dataset.date) {
    const rect = zone.getBoundingClientRect();
    const dayStart = Number(zone.dataset.dayStart ?? 0);
    const pxPerMin = Number(zone.dataset.pxPerMin ?? 1);
    const slot = Number(zone.dataset.slot ?? 15);
    const raw = dayStart + (y - rect.top) / pxPerMin;
    return { kind: 'timeline', date: zone.dataset.date, startMin: snap(raw, slot) };
  }
  return null;
}

/** Scrollt die Liste unter dem Zeiger weiter, wenn man an ihren Rand kommt. */
export function autoScroll(x: number, y: number) {
  const element = document.elementFromPoint(x, y);
  const scroller = element?.closest<HTMLElement>('[data-autoscroll]');
  if (!scroller) return;
  const rect = scroller.getBoundingClientRect();
  if (y - rect.top < EDGE_ZONE_PX) scroller.scrollTop -= EDGE_SPEED_PX;
  else if (rect.bottom - y < EDGE_ZONE_PX) scroller.scrollTop += EDGE_SPEED_PX;
}

export function useDrag(): DragContextValue {
  const context = useContext(DragContext);
  if (!context) throw new Error('useDrag benötigt einen DragProvider');
  return context;
}

/** Eigenschaften für eine Anfassfläche, die ein Ziehen auslöst. */
export function dragHandleProps(
  startDrag: DragContextValue['startDrag'],
  payload: DragPayload,
): {
  className: string;
  onPointerDown: (event: React.PointerEvent) => void;
  'aria-hidden': true;
} {
  return {
    className: 'grip',
    onPointerDown: (event) => {
      // Nur die primäre Taste zieht; Rechtsklick soll das Kontextmenü lassen.
      if (event.button !== 0) return;
      startDrag(payload, event);
    },
    'aria-hidden': true,
  };
}
