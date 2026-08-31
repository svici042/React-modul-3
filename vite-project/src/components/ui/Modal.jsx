import { useEffect, useRef } from "react";

export default function Modal({ title, children, label = title }) {
  const ref = useRef();
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={ref}
      >
        {children}
      </section>
    </div>
  );
}

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
