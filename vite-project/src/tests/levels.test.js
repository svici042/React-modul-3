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
});
