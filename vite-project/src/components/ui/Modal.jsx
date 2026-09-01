import { useEffect, useRef } from "react";

// --- Accessible dialog shell ---

export default function Modal({ title, children, label = title }) {
  const ref = useRef();

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = ref.current;
    const preferredFocus = dialog?.querySelector(
      "[autofocus], button:not(:disabled), input:not(:disabled), select:not(:disabled)",
    );

    (preferredFocus || dialog)?.focus();

    return () => {
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus();
      }
    };
  }, []);

  // Keep keyboard focus inside the active blocking dialog.
  function trapFocus(event) {
    if (event.key !== "Tab") {
      return;
    }

    const focusable = [
      ...event.currentTarget.querySelectorAll(
        "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      ),
    ];

    if (!focusable.length) {
      event.preventDefault();
      ref.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={ref}
        onKeyDown={trapFocus}
      >
        {children}
      </section>
    </div>
  );
}

// --- Keyboard control reference dialog ---

export function ControlGuide({ onClose }) {
  return (
    <Modal title="Controls" label="Vehicle controls">
      <button
        className="modal-close"
        onClick={onClose}
        aria-label="Close controls"
      >
        ×
      </button>
      <p className="eyebrow">PILOT REFERENCE / KEYBOARD</p>
      <h2>Vehicle controls</h2>
      <div className="controls-grid">
        <span>
          <kbd>W</kbd>
          <kbd>S</kbd>
        </span>
        <p>
          <b>Thrust</b>Forward / reverse
        </p>
        <span>
          <kbd>A</kbd>
          <kbd>D</kbd>
        </span>
        <p>
          <b>Yaw</b>Turn port / starboard
        </p>
        <span>
          <kbd>Q</kbd>
          <kbd>E</kbd>
        </span>
        <p>
          <b>Ballast</b>Descend / ascend
        </p>
        <span>
          <kbd>C</kbd>
        </span>
        <p>
          <b>Camera</b>Follow / cockpit / orbit
        </p>
        <span>
          <kbd>R</kbd>
          <kbd>X</kbd>
        </span>
        <p>
          <b>Science</b>Sonar ping / scan
        </p>
        <span>
          <kbd>F</kbd>
          <kbd>Space</kbd>
        </span>
        <p>
          <b>Systems</b>Lights / stabilize
        </p>
      </div>
      <button className="primary full" onClick={onClose}>
        Return to controls
      </button>
    </Modal>
  );
}
