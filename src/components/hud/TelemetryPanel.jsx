import {
  pressureFromDepth,
  temperatureFromDepth,
} from "../../simulation/calculations";
import {
  selectCurrentLevel,
  useSimulationStore,
} from "../../store/useSimulationStore";

function Meter({ label, value, tone = "cyan" }) {
  return (
    <div className="meter">
      <div className="meter-row">
        <span>{label}</span>
        <strong>{value.toFixed(0)}%</strong>
      </div>
      <div className="meter-track">
        <i className={tone} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function TelemetryPanel() {
  const battery = useSimulationStore((s) => s.battery);
  const hull = useSimulationStore((s) => s.hull);
  const lights = useSimulationStore((s) => s.lights);
  const level = useSimulationStore(selectCurrentLevel);
  const y = useSimulationStore((s) => s.position[1]);
  const depth = level.world.baseDepth + (level.world.maxY - y);
  return (
    <aside className="panel telemetry-panel" aria-label="Vehicle systems">
      <div className="panel-heading">
        <span>VESSEL SYSTEMS</span>
        <i className="status-dot" />
      </div>
      <Meter
        label="Energy reserve"
        value={battery}
        tone={battery < 20 ? "amber" : "cyan"}
      />
      <Meter
        label="Hull integrity"
        value={hull}
        tone={hull < 35 ? "red" : "cyan"}
      />
      <dl className="instrument-grid">
        <div>
          <dt>EXT PRESSURE</dt>
          <dd>
            {pressureFromDepth(depth).toFixed(0)} <small>bar</small>
          </dd>
        </div>
        <div>
          <dt>WATER TEMP</dt>
          <dd>
            {temperatureFromDepth(depth).toFixed(1)} <small>°C</small>
          </dd>
        </div>
        <div>
          <dt>LIGHT ARRAY</dt>
          <dd>{["OFF", "LOW", "HIGH"][lights]}</dd>
        </div>
        <div>
          <dt>LINK</dt>
          <dd className="good">STABLE</dd>
        </div>
      </dl>
      <p className="simulation-note">
        Educational simulation · values are simplified
      </p>
    </aside>
  );
}
