import { OBJECTIVES } from "../../simulation/mission";
import { OBJECTS } from "../../simulation/constants";
import { distance3 } from "../../simulation/calculations";
import { useSimulationStore } from "../../store/useSimulationStore";

export default function MissionPanel() {
  const mission = useSimulationStore((s) => s.mission);
  const samples = useSimulationStore((s) => s.samples);
  const events = useSimulationStore((s) => s.events);
  const scan = useSimulationStore((s) => s.scanNearby);
  const position = useSimulationStore((s) => s.position);
  const targetId = [
    "beacon",
    "beacon",
    "wreck",
    "wreck",
    "wreck",
    "extraction",
  ][mission.step];
  const target = OBJECTS.find((object) => object.id === targetId);
  return (
    <aside className="panel mission-panel" aria-label="Mission objectives">
      <div className="panel-heading">
        <span>MISSION DIRECTIVE</span>
        <b>{Math.min(mission.step + 1, 6)} / 6</b>
      </div>
      <p className="eyebrow">ECHOES OF THE ABYSS</p>
      <h2>{OBJECTIVES[mission.step] || "Mission complete"}</h2>
      {target && (
        <p className="objective-distance">
          TARGET RANGE / {distance3(position, target.position).toFixed(0)} m
        </p>
      )}
      <div
        className="progress-steps"
        aria-label={`Mission progress: ${Math.min(mission.step, 6)} of 6`}
      >
        {OBJECTIVES.map((_, i) => (
          <i
            key={i}
            className={
              i < mission.step ? "done" : i === mission.step ? "active" : ""
            }
          />
        ))}
      </div>
      {mission.step === 4 && (
        <button className="scan-action" onClick={scan}>
          Scan nearby point <kbd>X</kbd>
        </button>
      )}
      <section className="research-log">
        <div className="subheading">
          <span>RESEARCH LOG</span>
          <b>{samples.length}/3 samples</b>
        </div>
        {samples.length ? (
          samples.map((sample) => (
            <p key={sample}>
              ✓ {sample.replace("sample-", "Data point ").toUpperCase()}
            </p>
          ))
        ) : (
          <p className="muted">No specimen data archived</p>
        )}
      </section>
      <section className="event-log">
        <div className="subheading">
          <span>EVENT STREAM</span>
        </div>
        {events
          .slice(-4)
          .reverse()
          .map((event, i) => (
            <p key={`${event}-${i}`}>
              <time>{String(events.length - i).padStart(2, "0")}</time>
              {event}
            </p>
          ))}
      </section>
    </aside>
  );
}
