import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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

type DragState = {
  payload: DragPayload;
  x: number;
  y: number;
  target: DropTarget | null;
};

type DragContextValue = {
  state: DragState | null;
  startDrag: (payload: DragPayload, event: React.PointerEvent) => void;
};

const DragContext = createContext<DragContextValue | null>(null);

/** Wie nah am Rand einer Zeitachse das automatische Weiterscrollen einsetzt. */
const EDGE_ZONE_PX = 64;
const EDGE_SPEED_PX = 12;

function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Sucht unter dem Zeiger das nächstgelegene Ablageziel. */
function resolveTarget(x: number, y: number): DropTarget | null {
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
function autoScroll(x: number, y: number) {
  const element = document.elementFromPoint(x, y);
  const scroller = element?.closest<HTMLElement>('[data-autoscroll]');
  if (!scroller) return;
  const rect = scroller.getBoundingClientRect();
  if (y - rect.top < EDGE_ZONE_PX) scroller.scrollTop -= EDGE_SPEED_PX;
  else if (rect.bottom - y < EDGE_ZONE_PX) scroller.scrollTop += EDGE_SPEED_PX;
}

export function DragProvider({
  onDrop,
  children,
}: {
  onDrop: (payload: DragPayload, target: DropTarget) => void;
  children: ReactNode;
}) {
  const [state, setState] = useState<DragState | null>(null);
  const stateRef = useRef<DragState | null>(null);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  const update = useCallback((next: DragState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const startDrag = useCallback(
    (payload: DragPayload, event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      update({
        payload,
        x: event.clientX,
        y: event.clientY,
        target: resolveTarget(event.clientX, event.clientY),
      });
    },
    [update],
  );

  useEffect(() => {
    if (!state) return;

    const onMove = (event: PointerEvent) => {
      const current = stateRef.current;
      if (!current) return;
      event.preventDefault();
      autoScroll(event.clientX, event.clientY);
      update({
        ...current,
        x: event.clientX,
        y: event.clientY,
        target: resolveTarget(event.clientX, event.clientY),
      });
    };

    const finish = () => {
      const current = stateRef.current;
      update(null);
      if (current?.target) dropRef.current(current.payload, current.target);
    };

    const onCancel = () => update(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') update(null);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [state, update]);

  const value = useMemo(() => ({ state, startDrag }), [state, startDrag]);

  return (
    <DragContext.Provider value={value}>
      {children}
      {state && (
        <div className="drag-ghost" style={{ left: state.x, top: state.y }} aria-hidden>
          {state.payload.label}
        </div>
      )}
    </DragContext.Provider>
  );
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
