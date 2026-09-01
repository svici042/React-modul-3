import { OBJECTS, SONAR_RANGE } from "../../simulation/constants";
import { bearingToContact, distance3 } from "../../simulation/calculations";
import { degreesToRadians } from "../../simulation/direction";
import { useSimulationStore } from "../../store/useSimulationStore";

// --- User-triggered sonar audio ---

function pingSound() {
  // Create audio only after user input to satisfy browser autoplay policies.
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(740, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    310,
    context.currentTime + 0.5,
  );
  gain.gain.setValueAtTime(0.08, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.65);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.65);
  oscillator.onended = () => context.close();
}

// --- World-connected sonar instrument ---

export default function Sonar() {
  const position = useSimulationStore((s) => s.position);
  const heading = useSimulationStore((s) => s.heading);
  const contacts = useSimulationStore((s) => s.contacts);
  const cooldown = useSimulationStore((s) => s.sonarCooldown);
  const pulse = useSimulationStore((s) => s.sonarPulse);
  const muted = useSimulationStore((s) => s.preferences.muted);
  const fire = () => {
    if (useSimulationStore.getState().fireSonar() && !muted) pingSound();
  };

  return (
    <section className="sonar" aria-label="Active sonar">
      <div className="sonar-head">
        <span>ACTIVE SONAR</span>
        <b>{cooldown ? `CHARGE ${cooldown.toFixed(1)}s` : "READY"}</b>
      </div>
      <div className="sonar-scope">
        <i className={`sonar-sweep ${pulse ? "active" : ""}`} />
        <i className="sonar-line north" />
        <i className="sonar-line east" />
        <span className="north-label">N</span>
        <span className="range-label">{SONAR_RANGE}m</span>
        {contacts.map((id) => {
          const object = OBJECTS.find((item) => item.id === id);
          if (!object) {
            return null;
          }

          const distance = distance3(position, object.position);
          const angle = bearingToContact(
            position,
            degreesToRadians(heading),
            object.position,
          );

          // Convert range and bearing into percentage-based CSS coordinates.
          // 50/50 is the center; 43% leaves padding inside the circular edge.
          const radius = (distance / SONAR_RANGE) * 43;
          const x = 50 + Math.sin(angle) * radius;
          const y = 50 - Math.cos(angle) * radius;
          return (
            <i
              key={id}
              title={`${object.label}: ${distance.toFixed(0)} m`}
              className={`contact ${object.type}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="sr-only">
                {object.label}, {distance.toFixed(0)} metres
              </span>
            </i>
          );
        })}
        <i className="ownship" />
      </div>
      <button
        className="ping-button"
        onClick={fire}
        aria-disabled={cooldown > 0}
      >
        PING <kbd>R</kbd>
      </button>
    </section>
  );
}
