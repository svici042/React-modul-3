import { create } from "zustand";
import {
  CAMERA_MODES,
  OBJECTS,
  ROCKS,
  SONAR_COOLDOWN,
  WORLD,
} from "../simulation/constants";
import {
  clamp,
  clampVitals,
  collisionDamage,
  distance3,
  energyUse,
  inSonarRange,
  pressureFromDepth,
  seabedHeight,
  temperatureFromDepth,
  tickCooldown,
} from "../simulation/calculations";
import { resolveVehicleCollision } from "../simulation/collision";
import { integrateVehicleMotion } from "../simulation/direction";
import { OBJECTIVES, progressMission } from "../simulation/mission";
import {
  loadPreferences,
  resetPreferences,
  savePreferences,
} from "../utils/preferences";

const initialVehicle = () => ({
  position: [0, 48, 12],
  heading: 0,
  speed: 0,
  verticalSpeed: 0,
  battery: 100,
  hull: 100,
  sonarCooldown: 0,
  sonarPulse: 0,
  contacts: [],
  samples: [],
  lights: 1,
  collisionCooldown: 0,
  activeCollisionId: null,
});
const initialMission = () => ({ status: "intro", step: 0 });
const initialEvents = [
  "NAVCOM / Systems online",
  "MISSION / Briefing received",
];

const SOLID_OBJECTS = [
  ...OBJECTS.filter((object) => object.solid),
  ...ROCKS.filter((rock) => rock.scale >= 1.8).map((rock) => ({
    id: rock.id,
    position: [rock.x, seabedHeight(rock.x, rock.z) + rock.scale * 1.2, rock.z],
    radius: rock.scale * 2.2,
  })),
];

export const isGameplayActive = (state) =>
  state.mission.status === "running" &&
  !state.showControls &&
  !state.showSettings;

// This Zustand store is the single source of truth for the simulation. The 3D
// scene advances it through `tick`, while HUD components subscribe to slices.
export const useSimulationStore = create((set, get) => ({
  ...initialVehicle(),
  mission: initialMission(),
  events: initialEvents,
  input: {},
  preferences: loadPreferences(),
  showSettings: false,
  showControls: false,
  controlsReturnStatus: null,
  collisionFlash: 0,
  notice: "",
  noticeTimer: 0,

  // --- Mission lifecycle ---

  start: () =>
    set({
      mission: { status: "running", step: 0 },
      events: [...initialEvents, "DIVE / Mission clock started"],
      input: {},
      showSettings: false,
      showControls: false,
    }),
  pause: () =>
    set((s) =>
      s.mission.status === "running"
        ? {
            mission: { ...s.mission, status: "paused" },
            showSettings: true,
            showControls: false,
            input: {},
          }
        : {},
    ),
  resume: () =>
    set((s) =>
      s.mission.status === "paused"
        ? {
            mission: { ...s.mission, status: "running" },
            showSettings: false,
            showControls: false,
            input: {},
          }
        : {},
    ),
  restart: () =>
    set({
      ...initialVehicle(),
      mission: { status: "running", step: 0 },
      events: [...initialEvents, "DIVE / Mission restarted"],
      collisionFlash: 0,
      showSettings: false,
      showControls: false,
      controlsReturnStatus: null,
      input: {},
      notice: "",
      noticeTimer: 0,
    }),

  // --- Keyboard, pointer, and modal input state ---

  setInput: (key, value) =>
    set((s) => {
      if (value && !isGameplayActive(s)) {
        return s;
      }

      if (Boolean(s.input[key]) === value) {
        return s;
      }

      const input = { ...s.input };

      if (value) {
        input[key] = true;
      } else {
        delete input[key];
      }

      return { input };
    }),
  clearInput: () =>
    set((s) => (Object.keys(s.input).length ? { input: {} } : s)),
  stabilize: () =>
    set((s) =>
      isGameplayActive(s)
        ? {
            speed: 0,
            verticalSpeed: 0,
            input: {},
            notice: "STABILIZED",
            noticeTimer: 1.2,
          }
        : {},
    ),
  openControls: () =>
    set((s) => ({
      showControls: true,
      showSettings: false,
      controlsReturnStatus: s.mission.status,
      mission:
        s.mission.status === "running"
          ? { ...s.mission, status: "paused" }
          : s.mission,
      input: {},
    })),
  closeControls: () =>
    set((s) => {
      const returnToRunning = s.controlsReturnStatus === "running";

      return {
        showControls: false,
        showSettings: s.controlsReturnStatus === "paused",
        controlsReturnStatus: null,
        mission: returnToRunning
          ? { ...s.mission, status: "running" }
          : s.mission,
        input: {},
      };
    }),
  toggleControls: () => {
    const s = get();

    if (s.showControls) {
      s.closeControls();
    } else {
      s.openControls();
    }
  },

  // --- Persistent preferences and view modes ---

  setPreference: (key, value) =>
    set((s) => {
      const preferences = { ...s.preferences, [key]: value };
      savePreferences(preferences);
      return { preferences };
    }),
  resetPreferences: () => set({ preferences: resetPreferences() }),
  cycleCamera: () =>
    set((s) => {
      const index = CAMERA_MODES.indexOf(s.preferences.camera);
      const preferences = {
        ...s.preferences,
        camera: CAMERA_MODES[(index + 1) % CAMERA_MODES.length],
      };
      savePreferences(preferences);
      return { preferences };
    }),
  cycleLights: () => set((s) => ({ lights: (s.lights + 1) % 3 })),

  // --- Sonar and research interactions ---

  fireSonar: () => {
    const s = get();

    if (!isGameplayActive(s)) {
      return false;
    }

    if (s.sonarCooldown > 0) {
      set({
        notice: `SONAR RECHARGING · ${s.sonarCooldown.toFixed(1)}s`,
        noticeTimer: 1.5,
      });
      return false;
    }

    if (s.battery < 1) {
      set({ notice: "INSUFFICIENT ENERGY FOR SONAR", noticeTimer: 1.8 });
      return false;
    }

    // Resolve contacts from the same coordinates used by the 3D scene so the
    // sonar never displays synthetic contacts unrelated to world objects.
    const contacts = OBJECTS.filter((object) =>
      inSonarRange(s.position, object.position),
    ).map((object) => object.id);
    set({
      sonarCooldown: SONAR_COOLDOWN,
      sonarPulse: s.sonarPulse + 1,
      contacts,
      battery: clamp(s.battery - 0.8, 0, 100),
      notice: `${contacts.length} SONAR CONTACTS RESOLVED`,
      noticeTimer: 1.5,
      events: [
        ...s.events.slice(-6),
        `SONAR / ${contacts.length} contacts resolved`,
      ],
    });
    return true;
  },

  scanNearby: () => {
    const s = get();

    if (!isGameplayActive(s)) {
      return false;
    }

    if (s.mission.step !== 4) {
      set({ notice: "NO ACTIVE SCAN OBJECTIVE", noticeTimer: 1.5 });
      return false;
    }

    // Select only an unscanned sample within the ten-meter scan radius.
    const sample = OBJECTS.find(
      (o) =>
        o.type === "sample" &&
        !s.samples.includes(o.id) &&
        distance3(s.position, o.position) < 10,
    );
    if (sample) {
      set({
        samples: [...s.samples, sample.id],
        events: [...s.events.slice(-6), `SCIENCE / ${sample.label} archived`],
        notice: `${sample.label} · SCAN COMPLETE`,
        noticeTimer: 2,
      });
      return true;
    }

    set({ notice: "NO SAMPLE IN SCAN RANGE", noticeTimer: 1.5 });
    return false;
  },

  // --- Frame simulation loop ---

  // `tick` runs once per Three.js frame and owns physics, telemetry, collision,
  // and mission progression instead of distributing that logic across the UI.
  tick: (rawDt) => {
    const s = get();
    if (
      s.mission.status !== "running" ||
      (typeof document !== "undefined" && document.hidden)
    ) {
      return;
    }

    // Cap unusually long frames so returning to a browser tab cannot move the
    // vehicle a large distance in one physics step.
    const dt = Math.min(rawDt, 0.05);
    const disabled = s.battery <= 0 || s.hull <= 0;

    const motion = integrateVehicleMotion({
      position: s.position,
      heading: s.heading,
      speed: s.speed,
      verticalSpeed: s.verticalSpeed,
      input: s.input,
      dt,
      disabled,
      maxSpeed: WORLD.maxSpeed,
      maxVerticalSpeed: WORLD.maxVerticalSpeed,
    });
    const collision = resolveVehicleCollision(
      s.position,
      motion.attemptedPosition,
      SOLID_OBJECTS,
    );
    const enteredNewCollision =
      collision.collided && collision.collisionId !== s.activeCollisionId;
    const impactSpeed = Math.max(
      Math.abs(motion.speed),
      Math.abs(motion.verticalSpeed),
    );
    const damage =
      enteredNewCollision && s.collisionCooldown <= 0
        ? collisionDamage(impactSpeed)
        : 0;
    const speed = collision.collided ? 0 : motion.speed;
    const verticalSpeed = collision.collided ? 0 : motion.verticalSpeed;
    const position = collision.position;
    const heading = motion.heading;
    const use = energyUse({
      speed: motion.speed,
      verticalSpeed: motion.verticalSpeed,
      lights: s.lights,
      dt,
    });
    const vitals = clampVitals({
      battery: s.battery - use,
      hull: s.hull - damage,
    });
    const depth = WORLD.surfaceDepth + (WORLD.maxY - position[1]);
    const contacts = s.contacts.filter((id) =>
      OBJECTS.some((o) => o.id === id && inSonarRange(position, o.position)),
    );
    const snapshot = {
      ...s,
      ...vitals,
      position,
      depth,
      contacts,
      sonarFired: s.sonarCooldown > SONAR_COOLDOWN - 0.15,
    };

    // Evaluate objectives against the updated snapshot so actions advance the
    // mission during the same frame in which they occur.
    const mission = progressMission(s.mission, snapshot);
    const objectiveChanged = mission.step !== s.mission.step;
    const statusChanged = mission.status !== s.mission.status;
    const collisionEvent =
      damage > 0
        ? [...s.events.slice(-6), `IMPACT / Hull damaged ${damage.toFixed(0)}%`]
        : s.events;
    const events = objectiveChanged
      ? [
          ...collisionEvent.slice(-6),
          `MISSION / Objective ${mission.step + 1} active`,
        ]
      : statusChanged
        ? [
            ...collisionEvent.slice(-6),
            mission.status === "complete"
              ? "MISSION / Extraction confirmed"
              : "ALERT / Critical systems failure",
          ]
        : collisionEvent;
    const missionEnded = ["complete", "failed"].includes(mission.status);

    set({
      position,
      speed: missionEnded ? 0 : speed,
      verticalSpeed: missionEnded ? 0 : verticalSpeed,
      heading,
      ...vitals,
      sonarCooldown: tickCooldown(s.sonarCooldown, dt),
      collisionCooldown:
        damage > 0 ? 0.75 : Math.max(0, s.collisionCooldown - dt),
      activeCollisionId: collision.collided ? collision.collisionId : null,
      contacts,
      mission,
      events,
      input: missionEnded ? {} : s.input,
      notice:
        damage > 0
          ? "COLLISION · HULL DAMAGE"
          : s.noticeTimer - dt <= 0
            ? ""
            : s.notice,
      noticeTimer: damage > 0 ? 1.5 : Math.max(0, s.noticeTimer - dt),
      collisionFlash: collision.collided
        ? 1
        : Math.max(0, s.collisionFlash - dt * 2),
    });
  },
}));

export const selectTelemetry = (s) => {
  const depth = WORLD.surfaceDepth + (WORLD.maxY - s.position[1]);
  return {
    depth,
    pressure: pressureFromDepth(depth),
    temperature: temperatureFromDepth(depth),
    objective: OBJECTIVES[s.mission.step] || "Mission complete",
  };
};
