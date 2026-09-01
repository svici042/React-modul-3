import { LEVELS } from "../../data/levels";
import { CAMERA_MODES } from "../../simulation/constants";
import {
  TUTORIAL_STEPS,
  selectCurrentLevel,
  useSimulationStore,
} from "../../store/useSimulationStore";
import Modal, { ControlGuide } from "./Modal";

// --- Keyboard-accessible mission selection ---

function LevelSelect() {
  const progress = useSimulationStore((state) => state.progress);
  const selectLevel = useSimulationStore((state) => state.selectLevel);

  return (
    <Modal title="Mission select" label="Select a mission">
      <p className="eyebrow">NEREID VII / MISSION ARCHIVE</p>
      <h1>Choose a dive</h1>
      <div className="level-grid">
        {LEVELS.map((level) => {
          const unlocked = progress.unlocked.includes(level.id);
          const complete = Boolean(progress.completed[level.id]);
          const best = progress.bestBattery[level.id];

          return (
            <button
              className={`level-card ${complete ? "complete" : ""}`}
              key={level.id}
              disabled={!unlocked}
              onClick={() => selectLevel(level.id)}
            >
              <span className="level-number">
                MISSION {String(level.number).padStart(2, "0")}
              </span>
              <b>{level.title}</b>
              <small>{level.description}</small>
              <span className="level-meta">
                {level.difficulty} · {level.duration}
              </span>
              <em>
                {!unlocked
                  ? "LOCKED"
                  : complete
                    ? `COMPLETE${best === undefined ? "" : ` · BEST ${best.toFixed(0)}% POWER`}`
                    : "AVAILABLE"}
              </em>
            </button>
          );
        })}
      </div>
      <p className="legal">Complete each mission to unlock the next dive.</p>
    </Modal>
  );
}

// --- Short first-launch tutorial cards ---

function Tutorial() {
  const stepIndex = useSimulationStore((state) => state.tutorialStep);
  const next = useSimulationStore((state) => state.nextTutorial);
  const skip = useSimulationStore((state) => state.skipTutorial);
  const returning = useSimulationStore(
    (state) => state.tutorialReturnStatus === "paused",
  );
  const step = TUTORIAL_STEPS[stepIndex];

  return (
    <Modal title="Pilot tutorial">
      <p className="eyebrow">
        PILOT ORIENTATION · {stepIndex + 1}/{TUTORIAL_STEPS.length}
      </p>
      <div className="tutorial-key">{step.keys}</div>
      <h2>{step.title}</h2>
      <p className="intro-copy">{step.copy}</p>
      <div className="progress-steps">
        {TUTORIAL_STEPS.map((item, index) => (
          <i key={item.title} className={index <= stepIndex ? "active" : ""} />
        ))}
      </div>
      <div className="modal-actions">
        {!returning && <button onClick={skip}>Skip tutorial</button>}
        <button className="primary" onClick={next} autoFocus>
          {stepIndex === TUTORIAL_STEPS.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </Modal>
  );
}

// --- Level-aware briefing ---

function Intro() {
  const level = useSimulationStore(selectCurrentLevel);
  const start = useSimulationStore((state) => state.start);

  return (
    <Modal title={level.title}>
      <p className="eyebrow">
        MISSION {String(level.number).padStart(2, "0")} / {level.subtitle}
      </p>
      <div className="intro-mark">
        DSC <span>{String(level.number).padStart(2, "0")}</span>
      </div>
      <h1>{level.title}</h1>
      <p className="intro-copy">{level.briefing}</p>
      <div className="briefing-stats">
        <span>
          <b>{level.world.baseDepth} m</b>Base depth
        </span>
        <span>
          <b>{level.objectives.length}</b>Objectives
        </span>
        <span>
          <b>{level.difficulty}</b>Difficulty
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

// --- Pause and persistent settings ---

function Settings() {
  const state = useSimulationStore();

  return (
    <Modal title="Simulation paused">
      <p className="eyebrow">MISSION CLOCK HALTED</p>
      <h2>Simulation paused</h2>
      <div className="settings-list">
        <label>
          Graphics quality
          <select
            value={state.preferences.quality}
            onChange={(event) =>
              state.setPreference("quality", event.target.value)
            }
          >
            {["low", "medium", "high"].map((quality) => (
              <option key={quality} value={quality}>
                {quality}
              </option>
            ))}
          </select>
        </label>
        <label>
          Camera
          <select
            value={state.preferences.camera}
            onChange={(event) =>
              state.setPreference("camera", event.target.value)
            }
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
            checked={state.preferences.muted}
            onChange={(event) =>
              state.setPreference("muted", event.target.checked)
            }
          />
        </label>
        <label className="toggle-row">
          <span>Reduced motion</span>
          <input
            type="checkbox"
            checked={state.preferences.reducedMotion}
            onChange={(event) =>
              state.setPreference("reducedMotion", event.target.checked)
            }
          />
        </label>
      </div>
      <div className="settings-tools">
        <button onClick={state.reopenTutorial}>Reopen tutorial</button>
        <button onClick={state.resetTutorial}>Reset tutorial</button>
        <button onClick={state.resetProgress}>Reset progression</button>
        <button onClick={state.resetPreferences}>Reset preferences</button>
      </div>
      <div className="modal-actions">
        <button onClick={state.returnToSelect}>Mission select</button>
        <button onClick={state.restart}>Restart mission</button>
        <button className="primary" onClick={state.resume} autoFocus>
          Resume dive
        </button>
      </div>
    </Modal>
  );
}

// --- Completion and failure results ---

function EndState({ complete }) {
  const level = useSimulationStore(selectCurrentLevel);
  const mission = useSimulationStore((state) => state.mission);
  const stats = useSimulationStore((state) => state.stats);
  const hull = useSimulationStore((state) => state.hull);
  const battery = useSimulationStore((state) => state.battery);
  const restart = useSimulationStore((state) => state.restart);
  const nextLevel = useSimulationStore((state) => state.nextLevel);
  const returnToSelect = useSimulationStore((state) => state.returnToSelect);
  const hasNext = level.number < LEVELS.length;
  const elapsedMinutes = Math.floor(stats.elapsed / 60);
  const elapsedSeconds = Math.floor(stats.elapsed % 60);

  return (
    <Modal title={complete ? "Mission complete" : "Mission failed"}>
      <p className="eyebrow">
        {complete ? "EXTRACTION CONFIRMED" : "CRITICAL SYSTEM FAILURE"}
      </p>
      <div className={`end-icon ${complete ? "success" : "failure"}`}>
        {complete ? "✓" : "!"}
      </div>
      <h2>{complete ? `${level.title} complete` : mission.failureReason}</h2>
      <div className="result-grid">
        <span>
          <b>
            {elapsedMinutes}:{String(elapsedSeconds).padStart(2, "0")}
          </b>
          Elapsed
        </span>
        <span>
          <b>{hull.toFixed(0)}%</b>Hull
        </span>
        <span>
          <b>{battery.toFixed(0)}%</b>Battery
        </span>
        <span>
          <b>{stats.collisions}</b>Collisions
        </span>
        <span>
          <b>{stats.damageReceived.toFixed(0)}</b>Damage
        </span>
        <span>
          <b>{level.objectives.length}</b>Objectives
        </span>
      </div>
      <div className="modal-actions result-actions">
        <button onClick={returnToSelect}>Mission select</button>
        <button onClick={restart}>{complete ? "Replay" : "Retry"}</button>
        {complete && hasNext && (
          <button className="primary" onClick={nextLevel}>
            Next mission
          </button>
        )}
      </div>
    </Modal>
  );
}

// --- Overlay state router ---

export function Overlays() {
  const mission = useSimulationStore((state) => state.mission);
  const showControls = useSimulationStore((state) => state.showControls);
  const closeControls = useSimulationStore((state) => state.closeControls);

  if (showControls) return <ControlGuide onClose={closeControls} />;
  if (mission.status === "select") return <LevelSelect />;
  if (mission.status === "tutorial") return <Tutorial />;
  if (mission.status === "intro") return <Intro />;
  if (mission.status === "paused") return <Settings />;
  if (mission.status === "complete") return <EndState complete />;
  if (mission.status === "failed") return <EndState />;
  return null;
}
