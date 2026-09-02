import { useCallback, useEffect, useRef } from "react";
import {
  isGameplayActive,
  useSimulationStore,
} from "../../store/useSimulationStore";

export default function TouchControls() {
  const setInput = useSimulationStore((state) => state.setInput);
  const gameplayActive = useSimulationStore(isGameplayActive);
  const pointerActions = useRef(new Map());

  // --- Pointer ownership and release helpers ---

  const releasePointer = useCallback(
    (pointerId) => {
      const action = pointerActions.current.get(pointerId);

      if (!action) {
        return;
      }

      pointerActions.current.delete(pointerId);

      // Keep an action active while another pointer still owns the same action.
      const sameActionStillPressed = [
        ...pointerActions.current.values(),
      ].includes(action);

      if (!sameActionStillPressed) {
        setInput(action, false);
      }
    },
    [setInput],
  );

  const releaseAllPointers = useCallback(() => {
    const activeActions = new Set(pointerActions.current.values());
    pointerActions.current.clear();

    for (const action of activeActions) {
      setInput(action, false);
    }
  }, [setInput]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        releaseAllPointers();
      }
    }

    window.addEventListener("blur", releaseAllPointers);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", releaseAllPointers);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseAllPointers();
    };
  }, [releaseAllPointers]);

  useEffect(() => {
    if (!gameplayActive) {
      releaseAllPointers();
    }
  }, [gameplayActive, releaseAllPointers]);

  // --- Pointer event bindings shared by every touch button ---

  function bindPointer(action) {
    return {
      onPointerDown(event) {
        if (!gameplayActive) {
          return;
        }

        event.preventDefault();
        pointerActions.current.set(event.pointerId, action);
        setInput(action, true);

        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Older browsers still release the action through pointerleave.
        }
      },
      onPointerUp(event) {
        releasePointer(event.pointerId);

        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
      onPointerCancel: (event) => releasePointer(event.pointerId),
      onLostPointerCapture: (event) => releasePointer(event.pointerId),
      onPointerLeave(event) {
        if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          releasePointer(event.pointerId);
        }
      },
      onContextMenu: (event) => event.preventDefault(),
    };
  }

  return (
    <div className="touch-controls" aria-label="Touch vehicle controls">
      <div>
        <button
          {...bindPointer("left")}
          aria-label="Turn left"
          disabled={!gameplayActive}
        >
          ←
        </button>
        <button
          {...bindPointer("forward")}
          aria-label="Move forward"
          disabled={!gameplayActive}
        >
          ↑
        </button>
        <button
          {...bindPointer("right")}
          aria-label="Turn right"
          disabled={!gameplayActive}
        >
          →
        </button>
        <button
          {...bindPointer("backward")}
          aria-label="Move backward"
          disabled={!gameplayActive}
        >
          ↓
        </button>
      </div>
      <div>
        <button
          {...bindPointer("ascend")}
          aria-label="Ascend"
          disabled={!gameplayActive}
        >
          ASC
        </button>
        <button
          {...bindPointer("descend")}
          aria-label="Descend"
          disabled={!gameplayActive}
        >
          DSC
        </button>
      </div>
    </div>
  );
}

export function DesktopDriveIndicator() {
  const input = useSimulationStore((state) => state.input);

  return (
    <div className="drive-indicator" aria-label="Current thruster input">
      <span>
        <kbd className={input.forward ? "active" : ""}>W</kbd>
      </span>
      <span>
        <kbd className={input.left ? "active" : ""}>A</kbd>
        <i />
        <kbd className={input.right ? "active" : ""}>D</kbd>
      </span>
      <span>
        <kbd className={input.backward ? "active" : ""}>S</kbd>
      </span>
    </div>
  );
}
