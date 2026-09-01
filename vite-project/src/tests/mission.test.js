import { describe, expect, it } from "vitest";
import { LEVELS } from "../data/levels";
import { progressMission } from "../simulation/mission";

const level = LEVELS[1];
const base = {
  level,
  hull: 100,
  battery: 100,
  depth: level.world.baseDepth,
  position: level.start.position,
  sonarFired: false,
  discoveredObjects: [],
  scannedObjects: [],
  distanceTravelled: 0,
  reverseDistance: 0,
};

describe("mission compatibility entry point", () => {
  it("progresses only when the active objective is satisfied", () => {
    expect(progressMission({ status: "running", step: 0 }, base).step).toBe(0);
    expect(
      progressMission({ status: "running", step: 0 }, { ...base, depth: 3765 })
        .step,
    ).toBe(1);
  });

  it("completes extraction and fails on depleted vital systems", () => {
    expect(
      progressMission(
        { status: "running", step: level.objectives.length - 1 },
        {
          ...base,
          position: level.objects.find((item) => item.id === level.extractionId)
            .position,
        },
      ).status,
    ).toBe("complete");
    expect(
      progressMission({ status: "running", step: 2 }, { ...base, hull: 0 })
        .status,
    ).toBe("failed");
    expect(
      progressMission({ status: "running", step: 2 }, { ...base, battery: 0 })
        .status,
    ).toBe("failed");
  });
});
