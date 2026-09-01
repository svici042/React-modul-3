import { Component, lazy, Suspense } from "react";
import "./App.css";
import TelemetryPanel from "./components/hud/TelemetryPanel";
import MissionPanel from "./components/hud/MissionPanel";
import Sonar from "./components/hud/Sonar";
import TouchControls, {
  DesktopDriveIndicator,
} from "./components/hud/TouchControls";
import { Overlays } from "./components/ui/Overlays";
import { useKeyboardControls } from "./hooks/useKeyboardControls";
import { WORLD } from "./simulation/constants";
import { useSimulationStore } from "./store/useSimulationStore";

const UnderwaterScene = lazy(() => import("./scene/UnderwaterScene"));

// Keep the HUD available even when the WebGL viewport fails to initialize.
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        <b>3D viewport unavailable</b>
        <p>
          WebGL could not be initialized. Telemetry and mission controls remain
          available.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}

// --- Primary status bar ---

function TopBar() {
  const heading = useSimulationStore((s) => s.heading);
  const y = useSimulationStore((s) => s.position[1]);
  const depth = WORLD.surfaceDepth + (WORLD.maxY - y);
  const camera = useSimulationStore((s) => s.preferences.camera);
  const cycleCamera = useSimulationStore((s) => s.cycleCamera);
  const pause = useSimulationStore((s) => s.pause);
  const toggleControls = useSimulationStore((s) => s.toggleControls);
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">DSC</span>
        <span>
          <b>DEEP SEA CONTROL</b>
          <small>NEREID VII · DIVE 2407</small>
        </span>
      </div>
      <div className="top-metrics">
        <span>
          <small>DEPTH</small>
          <b>{depth.toFixed(1)} m</b>
        </span>
        <span>
          <small>HEADING</small>
          <b>{String(Math.round(heading)).padStart(3, "0")}°</b>
        </span>
        <span className="link">
          <i /> <b>LINK STABLE</b>
        </span>
      </div>
      <nav>
        <button onClick={cycleCamera} title="Change camera (C)">
          ◉ <span>{camera}</span>
        </button>
        <button onClick={toggleControls} title="Open controls guide">
          ? <span>Controls</span>
        </button>
        <button onClick={pause} title="Pause simulation (Esc)">
          Ⅱ <span>Pause</span>
        </button>
      </nav>
    </header>
  );
}

// --- Compact movement telemetry ---

function BottomTelemetry() {
  const speed = useSimulationStore((s) => s.speed);
  const vertical = useSimulationStore((s) => s.verticalSpeed);
  return (
    <div className="bottom-telemetry">
      <span>
        <small>VERTICAL</small>
        <b>
          {vertical >= 0 ? "+" : ""}
          {vertical.toFixed(1)}
        </b>
        <em>m/s</em>
      </span>
      <DesktopDriveIndicator />
      <span>
        <small>FORWARD</small>
        <b>
          {speed >= 0 ? "+" : ""}
          {speed.toFixed(1)}
        </b>
        <em>m/s</em>
      </span>
    </div>
  );
}

// --- Simulator composition and global overlays ---

function App() {
  // Register keyboard controls at the application boundary so they remain
  // independent of whichever HUD panel is currently visible.
  useKeyboardControls();
  const hull = useSimulationStore((s) => s.hull);
  const battery = useSimulationStore((s) => s.battery);
  const collision = useSimulationStore((s) => s.collisionFlash);
  const reduced = useSimulationStore((s) => s.preferences.reducedMotion);
  const notice = useSimulationStore((s) => s.notice);
  return (
    <main className={`simulator ${reduced ? "reduced-motion" : ""}`}>
      <a className="skip-link" href="#mission-panel">
        Skip to mission status
      </a>
      <section
        className="viewport"
        aria-label="Interactive underwater viewport"
      >
        <SceneBoundary>
          <Suspense
            fallback={
              <div className="scene-loading">
                <i />
                <span>Initializing bathymetry…</span>
              </div>
            }
          >
            <UnderwaterScene />
          </Suspense>
        </SceneBoundary>
      </section>
      <div className="vignette" aria-hidden="true" />
      <div
        className={`collision-alert ${collision ? "visible" : ""}`}
        aria-hidden="true"
      />
      <TopBar />
      <TelemetryPanel />
      <div id="mission-panel">
        <MissionPanel />
      </div>
      <Sonar />
      <BottomTelemetry />
      <TouchControls />
      {notice && (
        <div className="gameplay-notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}
      {(hull < 35 || battery < 20) && (
        <div className="critical-banner" role="status" aria-live="assertive">
          ⚠ {hull < 35 ? "HULL INTEGRITY CRITICAL" : "ENERGY RESERVE CRITICAL"}
        </div>
      )}
      <div className="status-summary sr-only" aria-label="Simulation status">
        Hull {hull.toFixed(0)} percent. Battery {battery.toFixed(0)} percent.
      </div>
      <Overlays />
    </main>
  );
}

export default App;
