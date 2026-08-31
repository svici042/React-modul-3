import { useSimulationStore } from "../../store/useSimulationStore";

export default function TouchControls() {
  const setInput = useSimulationStore((s) => s.setInput);
  const bind = (action) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      setInput(action, true);
    },
    onPointerUp: () => setInput(action, false),
    onPointerCancel: () => setInput(action, false),
  });
  return (
    <div className="touch-controls" aria-label="Touch vehicle controls">
      <div>
        <button {...bind("left")} aria-label="Turn left">
          ←
        </button>
        <button {...bind("forward")} aria-label="Move forward">
          ↑
        </button>
        <button {...bind("right")} aria-label="Turn right">
          →
        </button>
        <button {...bind("backward")} aria-label="Move backward">
          ↓
        </button>
      </div>
      <div>
        <button {...bind("ascend")} aria-label="Ascend">
          ASC
        </button>
        <button {...bind("descend")} aria-label="Descend">
          DSC
        </button>
      </div>
    </div>
  );
}

export function DesktopDriveIndicator() {
  return (
    <div className="drive-indicator" aria-hidden="true">
      <span>
        <kbd>W</kbd>
      </span>
      <span>
        <kbd>A</kbd>
        <i />
        <kbd>D</kbd>
      </span>
      <span>
        <kbd>S</kbd>
      </span>
    </div>
  );
}
