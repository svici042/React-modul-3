import { CAMERA_MODES } from "../../simulation/constants";
import { useSimulationStore } from "../../store/useSimulationStore";
import Modal, { ControlGuide } from "./Modal";

// --- Mission introduction ---

export function Intro() {
  const start = useSimulationStore((s) => s.start);
  return (
    <Modal title="Echoes of the Abyss">
      <p className="eyebrow">MISSION 01 / HADAL TRENCH</p>
      <div className="intro-mark">
        DSC <span>07</span>
      </div>
      <h1>Echoes of the Abyss</h1>
      <p className="intro-copy">
        A faint signal has surfaced from the Kermadec trench. Pilot research
        submersible <strong>Nereid VII</strong>, locate its source, and recover
        the lost data before power reserves are exhausted.
      </p>
      <div className="briefing-stats">
        <span>
          <b>3,740 m</b>Initial depth
        </span>
        <span>
          <b>1</b>Unknown signal
        </span>
        <span>
          <b>3</b>Data samples
        </span>
      </div>
      <button className="primary full" onClick={start} autoFocus>
        Begin descent
      </button>
      <p className="legal">
        Educational simulation · not a certified navigation system
      </p>
    </Modal>
  );
}

// --- Pause and simulation settings ---

export function Settings() {
  const s = useSimulationStore();
  const resume = s.resume;
  return (
    <Modal title="Simulation paused">
      <p className="eyebrow">MISSION CLOCK HALTED</p>
      <h2>Simulation paused</h2>
      <div className="settings-list">
        <label>
          Graphics quality
          <select
            value={s.preferences.quality}
            onChange={(e) => s.setPreference("quality", e.target.value)}
          >
            {["low", "medium", "high"].map((q) => (
              <option key={q} value={q}>
                {q[0].toUpperCase() + q.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Camera
          <select
            value={s.preferences.camera}
            onChange={(e) => s.setPreference("camera", e.target.value)}
          >
            {CAMERA_MODES.map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
        </label>
        <label className="toggle-row">
          <span>Mute sonar</span>
          <input
            type="checkbox"
            checked={s.preferences.muted}
            onChange={(e) => s.setPreference("muted", e.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>Reduced motion</span>
          <input
            type="checkbox"
            checked={s.preferences.reducedMotion}
            onChange={(e) => s.setPreference("reducedMotion", e.target.checked)}
          />
        </label>
      </div>
      <div className="modal-actions">
        <button onClick={s.restart}>Restart mission</button>
        <button onClick={s.resetPreferences}>Reset preferences</button>
        <button className="primary" onClick={resume} autoFocus>
          Resume dive
        </button>
      </div>
    </Modal>
  );
}

// --- Mission completion and failure states ---

export function EndState({ complete }) {
  const restart = useSimulationStore((s) => s.restart);
  return (
    <Modal title={complete ? "Mission complete" : "Mission failed"}>
      <p className="eyebrow">
        {complete ? "EXTRACTION CONFIRMED" : "CRITICAL SYSTEM FAILURE"}
      </p>
      <div className={`end-icon ${complete ? "success" : "failure"}`}>
        {complete ? "✓" : "!"}
      </div>
      <h2>{complete ? "Echoes recovered" : "Nereid VII disabled"}</h2>
      <p className="intro-copy">
        {complete
          ? "All three data points are secured. The recovery team has your signal and the mission archive is complete."
          : "Hull integrity or energy reserves reached a critical threshold. Review the route and attempt another dive."}
      </p>
      <button className="primary full" onClick={restart}>
        Restart mission
      </button>
    </Modal>
  );
}

// --- Overlay state router ---

export function Overlays() {
  const mission = useSimulationStore((s) => s.mission);
  const showControls = useSimulationStore((s) => s.showControls);
  const close = useSimulationStore((s) => s.closeControls);
  if (showControls) return <ControlGuide onClose={close} />;
  if (mission.status === "intro") return <Intro />;
  if (mission.status === "paused") return <Settings />;
  if (mission.status === "complete") return <EndState complete />;
  if (mission.status === "failed") return <EndState />;
  return null;
}
