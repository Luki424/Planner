import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DragContext,
  autoScroll,
  resolveTarget,
  type DragPayload,
  type DragState,
  type DropTarget,
} from './dragContext';

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

