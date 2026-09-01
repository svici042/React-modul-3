import { describe, expect, it } from "vitest";
import { LEVELS } from "../data/levels";
import {
  isObjectiveComplete,
  progressObjectives,
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
});
