import { beforeEach, describe, expect, it } from "vitest";
import { LEVELS, LEVEL_IDS, validateLevel } from "../data/levels";
import {
  completeLevel,
  defaultProgress,
  loadProgress,
  saveProgress,
} from "../utils/progression";
import { useSimulationStore } from "../store/useSimulationStore";
import { constrainPosition } from "../simulation/calculations";
import { getThermalExposure } from "../simulation/levelRuntime";
import { persistCompletedMission } from "../store/useSimulationStore";

const training = LEVELS[0];
const echoes = LEVELS[1];
const thermal = LEVELS[2];
const blackwater = LEVELS[3];

describe("data-driven levels and progression", () => {
  beforeEach(() => localStorage.clear());

  it("defines four unique, valid worlds with covered terrain", () => {
    expect(new Set(LEVEL_IDS).size).toBe(4);

    for (const level of LEVELS) {
      expect(validateLevel(level)).toEqual({ valid: true, errors: [] });
      expect(level.world.terrainSize).toBeGreaterThanOrEqual(500);
      expect(
        level.objects.some((object) => object.id === level.extractionId),
      ).toBe(true);
    }
  });

  it("constrains positions to each level's distinct boundaries", () => {
    for (const level of LEVELS) {
      const result = constrainPosition([999, -999, -999], level.world);
      expect(result[0]).toBe(level.world.xBound);
      expect(result[2]).toBe(level.world.zMin);
      expect(result[1]).toBeGreaterThanOrEqual(level.world.minY);
    }
  });

  it("unlocks levels in order and preserves the best battery result", () => {
    const initial = defaultProgress();
    expect(initial.unlocked).toEqual([LEVEL_IDS[0]]);

    const completed = completeLevel(initial, LEVEL_IDS[0], 72);
    const improved = completeLevel(completed, LEVEL_IDS[0], 81);

    expect(improved.unlocked).toContain(LEVEL_IDS[1]);
    expect(improved.bestBattery[LEVEL_IDS[0]]).toBe(81);
    saveProgress(improved);
    expect(loadProgress()).toEqual(improved);
  });

  it("recovers safely from malformed stored progress", () => {
    localStorage.setItem("deep-sea-level-progress", "{broken");
    expect(loadProgress()).toEqual(defaultProgress());
  });

  it("reports malformed or impossible level definitions without throwing", () => {
    for (const malformed of [
      null,
      4,
      {},
      { objects: null, objectives: "bad" },
    ]) {
      expect(() => validateLevel(malformed)).not.toThrow();
      expect(validateLevel(malformed).valid).toBe(false);
    }

    const duplicate = structuredClone(training);
    duplicate.objects[1].id = duplicate.objects[0].id;
    duplicate.objectives[1].id = duplicate.objectives[0].id;
    expect(validateLevel(duplicate).errors.join(" ")).toMatch(
      /Duplicate object ID|Duplicate objective ID/,
    );

    const impossible = structuredClone(echoes);
    impossible.objects.find((item) => item.id === "hull-fracture").position = [
      ...impossible.objects.find((item) => item.id === "abyss-wreck").position,
    ];
    expect(validateLevel(impossible).errors.join(" ")).toContain(
      "inside solid collider",
    );
  });

  it("applies thermal effects only to explicitly configured vents", () => {
    const abyssVent = echoes.objects.find((item) => item.id === "abyss-vent");
    const riftVent = thermal.objects.find((item) => item.id === "vent-a");
    const ridge = blackwater.objects.find(
      (item) => item.id === "blackwater-rock",
    );

    expect(getThermalExposure(echoes, abyssVent.position, 1)).toMatchObject({
      active: true,
      hullDamage: 0.7,
    });
    expect(getThermalExposure(thermal, riftVent.position, 0.5)).toMatchObject({
      active: true,
      hullDamage: 0.35,
    });
    expect(getThermalExposure(blackwater, ridge.position, 1)).toEqual({
      active: false,
      sourceIds: [],
      energyMultiplier: 1,
      hullDamage: 0,
    });
  });

  it("persists completion for objectives completed by an action", () => {
    const state = {
      mission: { status: "running", step: training.objectives.length - 1 },
      progress: defaultProgress(),
    };
    const progress = persistCompletedMission(
      state,
      training,
      { status: "complete", step: training.objectives.length },
      73,
    );

    expect(progress.completed[training.id]).toBe(true);
    expect(progress.unlocked).toContain(echoes.id);
  });

  it("rejects locked levels and fully resets transient state on selection", () => {
    useSimulationStore.setState({
      progress: defaultProgress(),
      contacts: ["stale"],
      scannedObjects: ["stale"],
      identifiedObjects: ["stale"],
      input: { forward: true },
      sonarEmission: { id: 8, position: [0, 0, 0], range: 20 },
      objectiveProgress: { objectiveId: "reverse", armed: true, distance: 9 },
      collisionFlash: 1,
      collisionCooldown: 1,
      activeCollisionId: "stale",
      notice: "STALE",
      noticeTimer: 5,
      tutorialReturnStatus: "paused",
      controlsReturnStatus: "running",
    });
    expect(useSimulationStore.getState().selectLevel(LEVEL_IDS[1])).toBe(false);

    useSimulationStore.setState({
      progress: {
        ...defaultProgress(),
        unlocked: [LEVEL_IDS[0], LEVEL_IDS[1]],
      },
    });
    expect(useSimulationStore.getState().selectLevel(LEVEL_IDS[1])).toBe(true);
    expect(useSimulationStore.getState().contacts).toEqual([]);
    expect(useSimulationStore.getState().scannedObjects).toEqual([]);
    expect(useSimulationStore.getState().identifiedObjects).not.toContain(
      "stale",
    );
    expect(useSimulationStore.getState().input).toEqual({});
    expect(useSimulationStore.getState().sonarEmission).toBeNull();
    expect(useSimulationStore.getState().objectiveProgress).toBeNull();
    expect(useSimulationStore.getState().collisionFlash).toBe(0);
    expect(useSimulationStore.getState().collisionCooldown).toBe(0);
    expect(useSimulationStore.getState().activeCollisionId).toBeNull();
    expect(useSimulationStore.getState().notice).toBe("");
    expect(useSimulationStore.getState().tutorialReturnStatus).toBeNull();
    expect(useSimulationStore.getState().controlsReturnStatus).toBeNull();

    useSimulationStore.getState().restart();
    expect(useSimulationStore.getState().levelId).toBe(LEVEL_IDS[1]);
    expect(useSimulationStore.getState().position).toEqual(
      LEVELS[1].start.position,
    );
  });

  it("clears objective progress on restart and level changes", () => {
    useSimulationStore.setState({
      levelId: training.id,
      progress: { ...defaultProgress(), unlocked: [training.id, echoes.id] },
      objectiveProgress: { objectiveId: "reverse", armed: true, distance: 8 },
    });
    useSimulationStore.getState().restart();
    expect(useSimulationStore.getState().objectiveProgress).toBeNull();

    useSimulationStore.setState({
      objectiveProgress: { objectiveId: "reverse", armed: true, distance: 8 },
    });
    useSimulationStore.getState().selectLevel(echoes.id);
    expect(useSimulationStore.getState().objectiveProgress).toBeNull();
  });

  it("returns safely to Level 1 selection when progression is reset", () => {
    useSimulationStore.setState({
      levelId: blackwater.id,
      progress: {
        unlocked: LEVELS.map((level) => level.id),
        completed: {},
        bestBattery: {},
      },
      mission: { status: "running", step: 3 },
      input: { forward: true },
      sonarEmission: { id: 4, position: [0, 0, 0], range: 20 },
      objectiveProgress: { objectiveId: "test", armed: true, distance: 5 },
      tutorialReturnStatus: "paused",
      controlsReturnStatus: "running",
    });
    useSimulationStore.getState().resetProgress();
    const state = useSimulationStore.getState();

    expect(state.levelId).toBe(training.id);
    expect(state.mission.status).toBe("select");
    expect(state.input).toEqual({});
    expect(state.sonarEmission).toBeNull();
    expect(state.objectiveProgress).toBeNull();
    expect(state.tutorialReturnStatus).toBeNull();
    expect(state.controlsReturnStatus).toBeNull();
  });
});
