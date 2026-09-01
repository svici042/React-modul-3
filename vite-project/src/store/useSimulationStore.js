import { create } from "zustand";
import { LEVEL_IDS, LEVELS, getLevel } from "../data/levels";
import {
  clamp,
  clampVitals,
  collisionDamage,
  distance3,
  energyUse,
  pressureFromDepth,
  temperatureFromDepth,
  tickCooldown,
} from "../simulation/calculations";
import { resolveVehicleCollision } from "../simulation/collision";
import { CAMERA_MODES, SONAR_COOLDOWN } from "../simulation/constants";
import { integrateVehicleMotion } from "../simulation/direction";
import {
  buildSolidObjects,
  getTargetTelemetry,
  getThermalExposure,
  initialDiscoveredObjects,
} from "../simulation/levelRuntime";
import {
  getObjectiveTargetIds,
  progressObjectives,
  updateReverseObjectiveProgress,
} from "../simulation/objectives";
import {
  completeLevel,
  loadProgress,
  loadTutorialCompletion,
  resetProgress,
  resetTutorial,
  saveTutorialCompletion,
} from "../utils/progression";
import {
  loadPreferences,
  resetPreferences,
  savePreferences,
} from "../utils/preferences";

export const TUTORIAL_STEPS = [
  {
    title: "Horizontal movement",
    copy: "Hold W to move forward and S to reverse.",
    keys: "W / S",
  },
  {
    title: "Steering",
    copy: "Use A and D to steer. Steering stays intuitive while reversing.",
    keys: "A / D",
  },
  {
    title: "Depth control",
    copy: "Hold Q to descend and E to ascend.",
    keys: "Q / E",
  },
  {
    title: "Mission tools",
    copy: "Press R for sonar and X to scan or interact nearby.",
    keys: "R / X",
  },
  {
    title: "Vehicle systems",
    copy: "F changes lights, C changes camera, and Space stabilizes.",
    keys: "F / C / SPACE",
  },
  {
    title: "Pause safely",
    copy: "Press Esc at any time to pause and release held controls.",
    keys: "ESC",
  },
];

function levelVehicle(level) {
  return {
    position: [...level.start.position],
    heading: level.start.heading,
    speed: 0,
    verticalSpeed: 0,
    movementDirection: 1,
    battery: level.start.battery,
    hull: level.start.hull,
    sonarCooldown: 0,
    sonarPulse: 0,
    sonarEmission: null,
    contacts: [],
    discoveredObjects: initialDiscoveredObjects(level),
    identifiedObjects: initialDiscoveredObjects(level),
    scannedObjects: [],
    samples: [],
    lights: 1,
    collisionCooldown: 0,
    activeCollisionId: null,
    objectiveProgress: null,
    solidObjects: buildSolidObjects(level),
    stats: {
      elapsed: 0,
      distanceTravelled: 0,
      reverseDistance: 0,
      collisions: 0,
      damageReceived: 0,
    },
  };
}

function missionSnapshot(state, level, overrides = {}) {
  return {
    level,
    position: state.position,
    depth: level.world.baseDepth + (level.world.maxY - state.position[1]),
    hull: state.hull,
    battery: state.battery,
    discoveredObjects: state.discoveredObjects,
    scannedObjects: state.scannedObjects,
    distanceTravelled: state.stats.distanceTravelled,
    reverseDistance: state.stats.reverseDistance,
    objectiveProgress: state.objectiveProgress,
    sonarFired: false,
    ...overrides,
  };
}

const appendEvent = (events, event) => [...events.slice(-7), event];

export function persistCompletedMission(state, level, mission, battery) {
  return mission.status === "complete" && state.mission.status !== "complete"
    ? completeLevel(state.progress, level.id, battery)
    : state.progress;
}

export const isGameplayActive = (state) =>
  state.mission.status === "running" &&
  !state.showControls &&
  !state.showSettings;

export const selectCurrentLevel = (state) => getLevel(state.levelId);

// The store owns every transient value so selecting or restarting a level can
// reset the complete simulation without leaking sonar, input, or collision data.
export const useSimulationStore = create((set, get) => {
  const initialLevel = LEVELS[0];

  return {
    levelId: initialLevel.id,
    ...levelVehicle(initialLevel),
    mission: { status: "select", step: 0, failureReason: "" },
    events: ["NAVCOM / Systems online"],
    input: {},
    preferences: loadPreferences(),
    progress: loadProgress(),
    tutorialComplete: loadTutorialCompletion(),
    tutorialStep: 0,
    tutorialReturnStatus: null,
    showSettings: false,
    showControls: false,
    controlsReturnStatus: null,
    collisionFlash: 0,
    sceneRevision: 0,
    notice: "",
    noticeTimer: 0,

    // --- Level selection and mission lifecycle ---

    selectLevel: (levelId) => {
      const state = get();

      if (
        !state.progress.unlocked.includes(levelId) ||
        !LEVEL_IDS.includes(levelId)
      ) {
        return false;
      }

      const level = getLevel(levelId);
      const showTutorial = level.number === 1 && !state.tutorialComplete;

      set({
        levelId,
        ...levelVehicle(level),
        mission: {
          status: showTutorial ? "tutorial" : "intro",
          step: 0,
          failureReason: "",
        },
        events: ["NAVCOM / Systems online", `MISSION / ${level.title} loaded`],
        input: {},
        tutorialStep: 0,
        tutorialReturnStatus: null,
        showSettings: false,
        showControls: false,
        controlsReturnStatus: null,
        collisionFlash: 0,
        notice: "",
        noticeTimer: 0,
        sceneRevision: state.sceneRevision + 1,
      });
      return true;
    },
    start: () =>
      set((state) => ({
        mission: {
          ...state.mission,
          status: "running",
          step: 0,
          failureReason: "",
        },
        events: appendEvent(state.events, "DIVE / Mission clock started"),
        input: {},
        showSettings: false,
        showControls: false,
      })),
    pause: () =>
      set((state) =>
        state.mission.status === "running"
          ? {
              mission: { ...state.mission, status: "paused" },
              showSettings: true,
              showControls: false,
              input: {},
            }
          : {},
      ),
    resume: () =>
      set((state) =>
        state.mission.status === "paused"
          ? {
              mission: { ...state.mission, status: "running" },
              showSettings: false,
              showControls: false,
              input: {},
            }
          : {},
      ),
    restart: () => {
      const current = get();
      const level = getLevel(current.levelId);
      set({
        ...levelVehicle(level),
        mission: { status: "running", step: 0, failureReason: "" },
        events: ["NAVCOM / Systems online", `DIVE / ${level.title} restarted`],
        input: {},
        showSettings: false,
        showControls: false,
        controlsReturnStatus: null,
        tutorialStep: 0,
        tutorialReturnStatus: null,
        collisionFlash: 0,
        notice: "",
        noticeTimer: 0,
        sceneRevision: current.sceneRevision + 1,
      });
    },
    returnToSelect: () => {
      const current = get();
      const level = getLevel(current.levelId);
      set({
        ...levelVehicle(level),
        mission: { status: "select", step: 0, failureReason: "" },
        events: ["NAVCOM / Awaiting mission selection"],
        input: {},
        showSettings: false,
        showControls: false,
        tutorialStep: 0,
        tutorialReturnStatus: null,
        controlsReturnStatus: null,
        collisionFlash: 0,
        notice: "",
        noticeTimer: 0,
        sceneRevision: current.sceneRevision + 1,
      });
    },
    nextLevel: () => {
      const nextId = LEVEL_IDS[LEVEL_IDS.indexOf(get().levelId) + 1];
      return nextId ? get().selectLevel(nextId) : false;
    },

    // --- Tutorial and blocking dialogs ---

    nextTutorial: () =>
      set((state) => {
        if (state.tutorialStep < TUTORIAL_STEPS.length - 1) {
          return { tutorialStep: state.tutorialStep + 1 };
        }

        saveTutorialCompletion(true);
        const returnToPause = state.tutorialReturnStatus === "paused";
        return {
          tutorialComplete: true,
          tutorialStep: 0,
          tutorialReturnStatus: null,
          mission: {
            ...state.mission,
            status: returnToPause ? "paused" : "intro",
          },
          showSettings: returnToPause,
        };
      }),
    skipTutorial: () => {
      saveTutorialCompletion(true);
      set((state) => ({
        tutorialComplete: true,
        tutorialStep: 0,
        mission: { ...state.mission, status: "intro" },
      }));
    },
    reopenTutorial: () =>
      set((state) => ({
        tutorialStep: 0,
        tutorialReturnStatus: "paused",
        showSettings: false,
        mission: { ...state.mission, status: "tutorial" },
        input: {},
      })),
    resetTutorial: () =>
      set({
        tutorialComplete: resetTutorial(),
        tutorialStep: 0,
        tutorialReturnStatus: null,
      }),
    resetProgress: () => {
      const level = LEVELS[0];
      const sceneRevision = get().sceneRevision + 1;
      set({
        levelId: level.id,
        ...levelVehicle(level),
        progress: resetProgress(),
        mission: { status: "select", step: 0, failureReason: "" },
        events: ["NAVCOM / Progression reset"],
        input: {},
        tutorialStep: 0,
        tutorialReturnStatus: null,
        controlsReturnStatus: null,
        showSettings: false,
        showControls: false,
        collisionFlash: 0,
        notice: "",
        noticeTimer: 0,
        sceneRevision,
      });
    },
    openControls: () =>
      set((state) => ({
        showControls: true,
        showSettings: false,
        controlsReturnStatus: state.mission.status,
        mission:
          state.mission.status === "running"
            ? { ...state.mission, status: "paused" }
            : state.mission,
        input: {},
      })),
    closeControls: () =>
      set((state) => ({
        showControls: false,
        showSettings: state.controlsReturnStatus === "paused",
        controlsReturnStatus: null,
        mission:
          state.controlsReturnStatus === "running"
            ? { ...state.mission, status: "running" }
            : state.mission,
        input: {},
      })),
    toggleControls: () => {
      const state = get();
      if (state.showControls) {
        state.closeControls();
      } else {
        state.openControls();
      }
    },

    // --- Input, preferences, and vehicle systems ---

    setInput: (key, value) =>
      set((state) => {
        if (
          (value && !isGameplayActive(state)) ||
          Boolean(state.input[key]) === value
        ) {
          return state;
        }

        const input = { ...state.input };
        if (value) input[key] = true;
        else delete input[key];
        return { input };
      }),
    clearInput: () =>
      set((state) => (Object.keys(state.input).length ? { input: {} } : state)),
    stabilize: () =>
      set((state) =>
        isGameplayActive(state)
          ? {
              speed: 0,
              verticalSpeed: 0,
              input: {},
              notice: "STABILIZED",
              noticeTimer: 1.2,
            }
          : {},
      ),
    setPreference: (key, value) =>
      set((state) => {
        const preferences = { ...state.preferences, [key]: value };
        savePreferences(preferences);
        return { preferences };
      }),
    resetPreferences: () => set({ preferences: resetPreferences() }),
    cycleCamera: () =>
      set((state) => {
        const index = CAMERA_MODES.indexOf(state.preferences.camera);
        const preferences = {
          ...state.preferences,
          camera: CAMERA_MODES[(index + 1) % CAMERA_MODES.length],
        };
        savePreferences(preferences);
        return { preferences };
      }),
    cycleLights: () => set((state) => ({ lights: (state.lights + 1) % 3 })),
    clearSonarEmission: (emissionId) =>
      set((state) =>
        state.sonarEmission?.id === emissionId
          ? { sonarEmission: null }
          : state,
      ),

    // --- Sonar discovery and range-limited interaction ---

    fireSonar: () => {
      const state = get();
      if (!isGameplayActive(state)) return false;

      if (state.sonarCooldown > 0) {
        set({
          notice: `SONAR RECHARGING · ${state.sonarCooldown.toFixed(1)}s`,
          noticeTimer: 1.5,
        });
        return false;
      }
      if (state.battery < 1) {
        set({ notice: "INSUFFICIENT ENERGY FOR SONAR", noticeTimer: 1.8 });
        return false;
      }

      const level = getLevel(state.levelId);
      const nearby = level.objects.filter(
        (object) =>
          distance3(state.position, object.position) <= level.sonarRange,
      );
      const contacts = nearby.map((object) => object.id);
      const discoveredObjects = [
        ...new Set([...state.discoveredObjects, ...contacts]),
      ];
      const battery = clamp(state.battery - 0.8, 0, 100);
      const mission = progressObjectives(
        state.mission,
        missionSnapshot(state, level, {
          battery,
          discoveredObjects,
          sonarFired: true,
        }),
      );
      const objectiveChanged = mission.step !== state.mission.step;
      const progress = persistCompletedMission(state, level, mission, battery);

      set({
        sonarCooldown: SONAR_COOLDOWN,
        sonarPulse: state.sonarPulse + 1,
        sonarEmission: {
          id: state.sonarPulse + 1,
          position: [...state.position],
          range: level.sonarRange,
        },
        contacts,
        discoveredObjects,
        battery,
        mission,
        progress,
        objectiveProgress: objectiveChanged ? null : state.objectiveProgress,
        input: mission.status === "complete" ? {} : state.input,
        notice: objectiveChanged
          ? "OBJECTIVE COMPLETE"
          : `${contacts.length} SONAR CONTACTS RESOLVED`,
        noticeTimer: 1.8,
        events: appendEvent(
          state.events,
          objectiveChanged
            ? "MISSION / Sonar objective complete"
            : `SONAR / ${contacts.length} contacts resolved`,
        ),
      });
      return true;
    },
    scanNearby: () => {
      const state = get();
      if (!isGameplayActive(state)) return false;

      const level = getLevel(state.levelId);
      const objective = level.objectives[state.mission.step];
      const guidance = getTargetTelemetry(
        level,
        objective,
        state.position,
        state.heading,
        {
          scannedObjects: state.scannedObjects,
          discoveredObjects: state.discoveredObjects,
          objectiveProgress: state.objectiveProgress,
        },
      );
      const target =
        guidance.target &&
        guidance.distance <= (objective?.range ?? guidance.target.scanRange)
          ? guidance.target
          : null;

      if (!target || !["scan", "scanAll"].includes(objective?.type)) {
        set({ notice: "NO ACTIVE TARGET IN SCAN RANGE", noticeTimer: 1.5 });
        return false;
      }

      const scannedObjects = [...state.scannedObjects, target.id];
      const discoveredObjects = [
        ...new Set([...state.discoveredObjects, target.id]),
      ];
      const identifiedObjects = [
        ...new Set([...state.identifiedObjects, target.id]),
      ];
      const mission = progressObjectives(
        state.mission,
        missionSnapshot(state, level, { scannedObjects, discoveredObjects }),
      );
      const objectiveChanged = mission.step !== state.mission.step;
      const progress = persistCompletedMission(
        state,
        level,
        mission,
        state.battery,
      );

      set({
        scannedObjects,
        samples: scannedObjects,
        discoveredObjects,
        identifiedObjects,
        mission,
        progress,
        objectiveProgress: objectiveChanged ? null : state.objectiveProgress,
        input: mission.status === "complete" ? {} : state.input,
        notice: objectiveChanged
          ? "OBJECTIVE COMPLETE"
          : `${target.label} · SCAN COMPLETE`,
        noticeTimer: 2,
        events: appendEvent(state.events, `SCIENCE / ${target.label} archived`),
      });
      return true;
    },

    // --- Frame simulation and collision response ---

    tick: (rawDt) => {
      const state = get();
      if (
        state.mission.status !== "running" ||
        (typeof document !== "undefined" && document.hidden)
      )
        return;

      const level = getLevel(state.levelId);
      const dt = Math.min(rawDt, 0.05);
      const motion = integrateVehicleMotion({
        position: state.position,
        heading: state.heading,
        speed: state.speed,
        verticalSpeed: state.verticalSpeed,
        movementDirection: state.movementDirection,
        input: state.input,
        dt,
        disabled: state.battery <= 0 || state.hull <= 0,
        maxSpeed: level.world.maxSpeed ?? 16,
        maxVerticalSpeed: level.world.maxVerticalSpeed ?? 6,
      });
      const collision = resolveVehicleCollision(
        state.position,
        motion.attemptedPosition,
        state.solidObjects,
        level.world,
      );
      const enteredCollision =
        collision.collided && collision.collisionId !== state.activeCollisionId;
      const impactSpeed = Math.max(
        Math.abs(motion.speed),
        Math.abs(motion.verticalSpeed),
      );
      const damage =
        enteredCollision && state.collisionCooldown <= 0
          ? collisionDamage(impactSpeed * collision.impactFactor)
          : 0;
      const position = collision.position;
      const speed = motion.speed * collision.speedFactor;
      const verticalSpeed = collision.blockedVertical
        ? 0
        : motion.verticalSpeed;
      const travel = distance3(state.position, position);
      const stats = {
        elapsed: state.stats.elapsed + dt,
        distanceTravelled: state.stats.distanceTravelled + travel,
        reverseDistance:
          state.stats.reverseDistance + (speed < -0.35 ? travel : 0),
        collisions: state.stats.collisions + (enteredCollision ? 1 : 0),
        damageReceived: state.stats.damageReceived + damage,
      };

      const activeObjective = level.objectives[state.mission.step];
      const objectiveProgress =
        activeObjective?.type === "reverse"
          ? updateReverseObjectiveProgress({
              objective: activeObjective,
              progress: state.objectiveProgress,
              level,
              previousPosition: state.position,
              position,
              speed,
            })
          : null;

      // Environmental effects are explicit level data; ordinary solid hazards
      // such as collapsed ridges never inherit thermal behavior.
      const thermal = getThermalExposure(level, position, dt);
      const use =
        energyUse({ speed, verticalSpeed, lights: state.lights, dt }) *
        level.world.energyMultiplier *
        thermal.energyMultiplier;
      const vitals = clampVitals({
        battery: state.battery - use,
        hull: state.hull - damage - thermal.hullDamage,
      });
      const contacts = state.contacts.filter((id) => {
        const object = level.objects.find((item) => item.id === id);
        return (
          object && distance3(position, object.position) <= level.sonarRange
        );
      });
      const mission = progressObjectives(
        state.mission,
        missionSnapshot(
          { ...state, ...vitals, position, stats, objectiveProgress },
          level,
        ),
      );
      const objectiveChanged = mission.step !== state.mission.step;
      const statusChanged = mission.status !== state.mission.status;
      const completedObjective = level.objectives[state.mission.step];
      const identifiedObjects =
        objectiveChanged && completedObjective?.type === "proximity"
          ? [
              ...new Set([
                ...state.identifiedObjects,
                ...getObjectiveTargetIds(completedObjective),
              ]),
            ]
          : state.identifiedObjects;
      let events = state.events;

      if (damage > 0)
        events = appendEvent(
          events,
          `IMPACT / Hull damaged ${damage.toFixed(0)}%`,
        );
      if (objectiveChanged) {
        const next = level.objectives[mission.step];
        events = appendEvent(
          events,
          next ? `MISSION / ${next.title}` : "MISSION / Extraction confirmed",
        );
      } else if (statusChanged && mission.status === "failed") {
        events = appendEvent(events, `ALERT / ${mission.failureReason}`);
      }

      const progress = persistCompletedMission(
        state,
        level,
        mission,
        vitals.battery,
      );
      const missionEnded = ["complete", "failed"].includes(mission.status);

      set({
        position,
        heading: motion.heading,
        speed: missionEnded ? 0 : speed,
        verticalSpeed: missionEnded ? 0 : verticalSpeed,
        movementDirection: motion.movementDirection,
        ...vitals,
        stats,
        objectiveProgress: objectiveChanged ? null : objectiveProgress,
        contacts,
        identifiedObjects,
        mission,
        progress,
        sonarCooldown: tickCooldown(state.sonarCooldown, dt),
        collisionCooldown:
          damage > 0 ? 0.75 : Math.max(0, state.collisionCooldown - dt),
        activeCollisionId: collision.collided ? collision.collisionId : null,
        collisionFlash: collision.collided
          ? 1
          : Math.max(0, state.collisionFlash - dt * 2),
        input: missionEnded ? {} : state.input,
        events,
        notice:
          damage > 0
            ? "COLLISION · HULL DAMAGE"
            : thermal.active
              ? "THERMAL EXPOSURE · MOVE CLEAR"
              : objectiveChanged
                ? "OBJECTIVE COMPLETE"
                : state.noticeTimer - dt <= 0
                  ? ""
                  : state.notice,
        noticeTimer:
          damage > 0 || thermal.active || objectiveChanged
            ? 1.5
            : Math.max(0, state.noticeTimer - dt),
      });
    },
  };
});

export const selectTelemetry = (state) => {
  const level = getLevel(state.levelId);
  const depth = level.world.baseDepth + (level.world.maxY - state.position[1]);

  return {
    depth,
    pressure: pressureFromDepth(depth),
    temperature: temperatureFromDepth(depth),
    objective:
      level.objectives[state.mission.step]?.title ?? "Mission complete",
  };
};
