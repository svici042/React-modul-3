import { describe, expect, it } from "vitest";
import { LEVELS } from "../data/levels";
import { getTargetTelemetry } from "../simulation/levelRuntime";
import {
  isObjectiveComplete,
  progressObjectives,
  updateReverseObjectiveProgress,
} from "../simulation/objectives";

function completingSnapshot(level, objective) {
  const target = level.objects.find(
    (object) => object.id === (objective.finishTargetId ?? objective.targetId),
  );
  const targetIds = objective.targetIds ?? [];

  return {
    level,
    position: target?.position ?? level.start.position,
    depth: objective.depth ?? level.world.baseDepth,
    hull: 100,
    battery: 100,
    distanceTravelled: objective.minDistance ?? 100,
    reverseDistance: objective.distance ?? 100,
    objectiveProgress:
      objective.type === "reverse"
        ? {
            objectiveId: objective.id,
            armed: true,
            distance: objective.distance,
          }
        : null,
    sonarFired: ["sonar", "sonarAll"].includes(objective.type),
    discoveredObjects: [objective.targetId, ...targetIds].filter(Boolean),
    scannedObjects: [objective.targetId, ...targetIds].filter(Boolean),
  };
}

describe("generic objective progression", () => {
  const training = LEVELS[0];
  const echoes = LEVELS[1];

  it("does not advance an unsatisfied active objective", () => {
    const snapshot = completingSnapshot(echoes, echoes.objectives[0]);
    expect(
      progressObjectives(
        { status: "running", step: 0 },
        { ...snapshot, depth: echoes.world.baseDepth },
      ).step,
    ).toBe(0);
  });

  it.each(LEVELS.map((level) => [level.title, level]))(
    "can complete every objective in %s one event at a time",
    (_, level) => {
      let mission = { status: "running", step: 0 };

      for (const objective of level.objectives) {
        mission = progressObjectives(
          mission,
          completingSnapshot(level, objective),
        );
      }

      expect(mission.status).toBe("complete");
      expect(mission.step).toBe(level.objectives.length);
    },
  );

  it("requires scan range to be enforced by interaction and the correct scan action", () => {
    const level = LEVELS[0];
    const objective = level.objectives.find((item) => item.type === "scan");
    const snapshot = completingSnapshot(level, objective);

    expect(
      isObjectiveComplete(objective, { ...snapshot, scannedObjects: [] }),
    ).toBe(false);
    expect(isObjectiveComplete(objective, snapshot)).toBe(true);
  });

  it("keeps hidden contacts undiscovered until sonar reports them", () => {
    const level = LEVELS[1];
    const objective = level.objectives.find((item) => item.type === "sonar");
    const snapshot = completingSnapshot(level, objective);

    expect(
      isObjectiveComplete(objective, { ...snapshot, discoveredObjects: [] }),
    ).toBe(false);
    expect(
      isObjectiveComplete(objective, { ...snapshot, sonarFired: false }),
    ).toBe(false);
  });

  it("fails on depleted hull or battery", () => {
    const level = LEVELS[0];
    const snapshot = completingSnapshot(level, level.objectives[0]);

    expect(
      progressObjectives(
        { status: "running", step: 0 },
        { ...snapshot, hull: 0 },
      ).status,
    ).toBe("failed");
    expect(
      progressObjectives(
        { status: "running", step: 0 },
        { ...snapshot, battery: 0 },
      ).status,
    ).toBe("failed");
  });

  it("counts reverse travel only after arming inside the marked corridor", () => {
    const objective = training.objectives.find(
      (item) => item.type === "reverse",
    );
    const outside = [80, 12, -128];
    let progress = updateReverseObjectiveProgress({
      objective,
      progress: { objectiveId: "older-objective", armed: true, distance: 99 },
      level: training,
      previousPosition: outside,
      position: [80, 12, -118],
      speed: -5,
    });
    expect(progress).toEqual({
      objectiveId: objective.id,
      armed: false,
      distance: 0,
    });

    const start = training.objects.find(
      (item) => item.id === objective.startTargetId,
    ).position;
    progress = updateReverseObjectiveProgress({
      objective,
      progress,
      level: training,
      previousPosition: start,
      position: start,
      speed: -5,
    });
    expect(progress.armed).toBe(true);

    progress = updateReverseObjectiveProgress({
      objective,
      progress,
      level: training,
      previousPosition: start,
      position: [20, 12, -118],
      speed: 4,
    });
    expect(progress.distance).toBe(0);

    progress = updateReverseObjectiveProgress({
      objective,
      progress,
      level: training,
      previousPosition: start,
      position: [20, 12, -118],
      speed: -4,
    });
    progress = updateReverseObjectiveProgress({
      objective,
      progress,
      level: training,
      previousPosition: [20, 12, -118],
      position: [20, 12, -108],
      speed: -4,
    });

    expect(progress.distance).toBeCloseTo(20);
    expect(
      isObjectiveComplete(objective, {
        level: training,
        position: [20, 12, -108],
        objectiveProgress: progress,
      }),
    ).toBe(true);
  });

  it("moves scanAll guidance to the nearest unresolved discovered record", () => {
    const objective = echoes.objectives.find((item) => item.type === "scanAll");
    const position = [86, 12, -205];
    const discoveredObjects = [...objective.targetIds];
    const first = getTargetTelemetry(echoes, objective, position, 0, {
      discoveredObjects,
      scannedObjects: [],
    });
    const second = getTargetTelemetry(echoes, objective, position, 0, {
      discoveredObjects,
      scannedObjects: [first.target.id],
    });
    const third = getTargetTelemetry(echoes, objective, position, 0, {
      discoveredObjects,
      scannedObjects: [first.target.id, second.target.id],
    });

    expect(
      new Set([first.target.id, second.target.id, third.target.id]).size,
    ).toBe(3);
    expect(
      getTargetTelemetry(echoes, objective, position, 0, {
        discoveredObjects: [],
        scannedObjects: [],
      }),
    ).toMatchObject({ target: null, requiresDiscovery: true });
  });
});
