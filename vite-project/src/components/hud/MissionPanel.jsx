import { getTargetTelemetry } from "../../simulation/levelRuntime";
import {
  selectCurrentLevel,
  useSimulationStore,
} from "../../store/useSimulationStore";

export default function MissionPanel() {
  const level = useSimulationStore(selectCurrentLevel);
  const mission = useSimulationStore((state) => state.mission);
  const scanned = useSimulationStore((state) => state.scannedObjects);
  const discovered = useSimulationStore((state) => state.discoveredObjects);
  const identified = useSimulationStore((state) => state.identifiedObjects);
  const events = useSimulationStore((state) => state.events);
  const scan = useSimulationStore((state) => state.scanNearby);
  const position = useSimulationStore((state) => state.position);
  const heading = useSimulationStore((state) => state.heading);
  const objectiveProgress = useSimulationStore(
    (state) => state.objectiveProgress,
  );
  const objective = level.objectives[mission.step];
  const telemetry = getTargetTelemetry(level, objective, position, heading, {
    scannedObjects: scanned,
    discoveredObjects: discovered,
    objectiveProgress,
  });
  const needsDiscovery = telemetry.requiresDiscovery;
  const instruction = needsDiscovery
    ? "Target not yet discovered. Press R to use sonar, then follow its bearing."
    : objective?.instruction;

  return (
    <aside className="panel mission-panel" aria-label="Mission objectives">
      <div className="panel-heading">
        <span>MISSION DIRECTIVE</span>
        <b>
          {Math.min(mission.step + 1, level.objectives.length)} /{" "}
          {level.objectives.length}
        </b>
      </div>
      <p className="eyebrow">{level.title.toUpperCase()}</p>
      <h2>{objective?.title ?? "Mission complete"}</h2>
      {objective && <p className="objective-copy">{instruction}</p>}
      {objective?.key && (
        <p className="control-hint">
          ACTION <kbd>{needsDiscovery ? "R" : objective.key}</kbd>
        </p>
      )}
      {telemetry.target && (
        <div
          className="target-guidance"
          aria-label={`Target ${telemetry.distance.toFixed(0)} metres, bearing ${telemetry.bearing.toFixed(0)} degrees`}
        >
          <i style={{ transform: `rotate(${telemetry.bearing}deg)` }}>↑</i>
          <span>
            <b>
              {identified.includes(telemetry.target.id)
                ? telemetry.target.label
                : "UNKNOWN CONTACT"}
            </b>
            {telemetry.distance.toFixed(0)} m ·{" "}
            {telemetry.bearing > 0 ? "RIGHT" : "LEFT"}{" "}
            {Math.abs(telemetry.bearing).toFixed(0)}°
          </span>
        </div>
      )}
      {needsDiscovery && (
        <p className="objective-distance">TARGET UNKNOWN · USE SONAR</p>
      )}
      {objective?.type === "reverse" && (
        <p className="objective-distance">
          {objectiveProgress?.armed
            ? `REVERSE MANOEUVRE ${Math.min(objective.distance, objectiveProgress.distance).toFixed(0)} / ${objective.distance} m`
            : "ENTER THE REVERSE START AREA"}
        </p>
      )}
      <div
        className="progress-steps"
        aria-label={`Mission progress: ${mission.step} of ${level.objectives.length}`}
      >
        {level.objectives.map((item, index) => (
          <i
            key={item.id}
            className={
              index < mission.step
                ? "done"
                : index === mission.step
                  ? "active"
                  : ""
            }
          />
        ))}
      </div>
      {["scan", "scanAll"].includes(objective?.type) && (
        <>
          <p className="scan-hint">
            {needsDiscovery
              ? "TARGET UNKNOWN · PRESS R"
              : telemetry.distance <= (objective.range ?? 10)
                ? `IN RANGE · ${telemetry.target?.label}`
                : `NEXT TARGET · ${telemetry.distance?.toFixed(0) ?? "—"} m`}
          </p>
          <button className="scan-action" onClick={scan}>
            Interact / scan <kbd>X</kbd>
          </button>
        </>
      )}
      <section className="research-log">
        <div className="subheading">
          <span>MISSION DATA</span>
          <b>{scanned.length} archived</b>
        </div>
        {scanned.length ? (
          scanned
            .slice(-3)
            .map((id) => (
              <p key={id}>
                ✓{" "}
                {level.objects.find((object) => object.id === id)?.label ?? id}
              </p>
            ))
        ) : (
          <p className="muted">No mission data archived</p>
        )}
      </section>
      <section className="event-log">
        <div className="subheading">
          <span>EVENT STREAM</span>
        </div>
        {events
          .slice(-4)
          .reverse()
          .map((event, index) => (
            <p key={`${events.length - index}-${event}`}>
              <time>{String(events.length - index).padStart(2, "0")}</time>
              {event}
            </p>
          ))}
      </section>
    </aside>
  );
}
