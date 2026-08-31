import { create } from "zustand";
import {
  CAMERA_MODES,
  OBJECTS,
  SONAR_COOLDOWN,
  WORLD,
} from "../simulation/constants";
import {
  clamp,
  clampVitals,
  collisionDamage,
  constrainPosition,
  distance3,
  energyUse,
  inSonarRange,
  normalizeHeading,
  pressureFromDepth,
  temperatureFromDepth,
  tickCooldown,
} from "../simulation/calculations";
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
});
const initialMission = () => ({ status: "intro", step: 0 });
const initialEvents = [
  "NAVCOM / Systems online",
  "MISSION / Briefing received",
];

// Ši Zustand saugykla yra vienintelis simuliacijos būsenos šaltinis.
// 3D scena keičia būseną per `tick`, o HUD tik prenumeruoja reikalingas reikšmes.
export const useSimulationStore = create((set, get) => ({
  ...initialVehicle(),
  mission: initialMission(),
  events: initialEvents,
  input: {},
  preferences: loadPreferences(),
  showSettings: false,
  showControls: false,
  collisionFlash: 0,
  lastObjective: 0,

  start: () =>
    set({
      mission: { status: "running", step: 0 },
      events: [...initialEvents, "DIVE / Mission clock started"],
    }),
  pause: () =>
    set((s) =>
      s.mission.status === "running"
        ? { mission: { ...s.mission, status: "paused" }, showSettings: true }
        : {},
    ),
  resume: () =>
    set((s) =>
      s.mission.status === "paused"
        ? { mission: { ...s.mission, status: "running" }, showSettings: false }
        : {},
    ),
  restart: () =>
    set({
      ...initialVehicle(),
      mission: { status: "running", step: 0 },
      events: [...initialEvents, "DIVE / Mission restarted"],
      collisionFlash: 0,
      showSettings: false,
      lastObjective: 0,
    }),
  setInput: (key, value) =>
    set((s) => ({ input: { ...s.input, [key]: value } })),
  stop: () => set({ speed: 0, verticalSpeed: 0, input: {} }),
  toggleControls: () => set((s) => ({ showControls: !s.showControls })),
  closeModals: () => set({ showControls: false, showSettings: false }),
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

  fireSonar: () => {
    const s = get();
    if (
      s.mission.status !== "running" ||
      s.sonarCooldown > 0 ||
      s.battery < 1
    ) {
      return false;
    }

    // Kontaktai skaičiuojami iš tų pačių koordinačių, kurias naudoja 3D scena,
    // todėl sonaro ekrane rodomi tik realūs pasaulio objektai.
    const contacts = OBJECTS.filter((object) =>
      inSonarRange(s.position, object.position),
    ).map((object) => object.id);
    set({
      sonarCooldown: SONAR_COOLDOWN,
      sonarPulse: s.sonarPulse + 1,
      contacts,
      battery: clamp(s.battery - 0.8, 0, 100),
      events: [
        ...s.events.slice(-6),
        `SONAR / ${contacts.length} contacts resolved`,
      ],
    });
    return true;
  },

  scanNearby: () => {
    const s = get();
    if (s.mission.status !== "running" || s.mission.step !== 4) {
      return;
    }

    // Randame tik dar nenuskenuotą mėginį, esantį ne toliau kaip 10 metrų.
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
      });
    }
  },

  // `tick` kviečiamas kartą per Three.js kadrą. Čia atliekama fizika,
  // telemetrija ir misijos progreso patikra, o ne pačiuose UI komponentuose.
  tick: (rawDt) => {
    const s = get();
    if (
      s.mission.status !== "running" ||
      (typeof document !== "undefined" && document.hidden)
    ) {
      return;
    }

    // Apribojame labai ilgą kadrą, kad grįžus į naršyklės skirtuką
    // aparatas neperšoktų didelio atstumo vienu fizikos žingsniu.
    const dt = Math.min(rawDt, 0.05);
    const disabled = s.battery <= 0 || s.hull <= 0;
    const forward = disabled
      ? 0
      : Number(Boolean(s.input.forward)) - Number(Boolean(s.input.backward));
    const turn = disabled
      ? 0
      : Number(Boolean(s.input.left)) - Number(Boolean(s.input.right));
    const vertical = disabled
      ? 0
      : Number(Boolean(s.input.ascend)) - Number(Boolean(s.input.descend));
    const targetSpeed = forward * WORLD.maxSpeed;
    const targetVertical = vertical * WORLD.maxVerticalSpeed;

    // Palaipsniui artėjame prie norimo greičio, todėl aparatas turi inerciją.
    const speed =
      s.speed +
      (targetSpeed - s.speed) * Math.min(1, dt * (forward ? 1.4 : 2.2));
    const verticalSpeed =
      s.verticalSpeed +
      (targetVertical - s.verticalSpeed) *
        Math.min(1, dt * (vertical ? 1.8 : 2.8));
    const heading = normalizeHeading(
      s.heading + turn * dt * 42 * (0.35 + Math.abs(speed) / WORLD.maxSpeed),
    );
    const rad = (heading * Math.PI) / 180;

    // Greitį ir kryptį paverčiame nauja X/Y/Z pozicija.
    const attempted = [
      s.position[0] + Math.sin(rad) * speed * dt,
      s.position[1] + verticalSpeed * dt,
      s.position[2] - Math.cos(rad) * speed * dt,
    ];
    const position = constrainPosition(attempted);

    // Skirtumas tarp bandytos ir leistinos pozicijos reiškia smūgį į ribą arba dugną.
    let impact = attempted.some(
      (value, i) => Math.abs(value - position[i]) > 0.01,
    )
      ? Math.max(Math.abs(speed), Math.abs(verticalSpeed))
      : 0;

    for (const object of OBJECTS.filter((o) => o.type === "hazard")) {
      if (distance3(position, object.position) < object.radius) {
        impact = Math.max(impact, Math.abs(speed) + 2.5);
      }
    }

    const damage = collisionDamage(impact);
    const use = energyUse({ speed, verticalSpeed, lights: s.lights, dt });
    const vitals = clampVitals({
      battery: s.battery - use,
      hull: s.hull - damage * dt * 2.5,
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

    // Tikslai tikrinami su jau atnaujinta būsena, todėl reaguoja tame pačiame kadre.
    const mission = progressMission(s.mission, snapshot);
    const objectiveChanged = mission.step !== s.mission.step;
    const statusChanged = mission.status !== s.mission.status;
    const events = objectiveChanged
      ? [
          ...s.events.slice(-6),
          `MISSION / Objective ${mission.step + 1} active`,
        ]
      : statusChanged
        ? [
            ...s.events.slice(-6),
            mission.status === "complete"
              ? "MISSION / Extraction confirmed"
              : "ALERT / Critical systems failure",
          ]
        : s.events;
    set({
      position,
      speed,
      verticalSpeed,
      heading,
      ...vitals,
      sonarCooldown: tickCooldown(s.sonarCooldown, dt),
      contacts,
      mission,
      events,
      collisionFlash: damage > 0 ? 1 : Math.max(0, s.collisionFlash - dt * 2),
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
