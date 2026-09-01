import { describe, expect, it } from "vitest";
import { progressMission } from "../simulation/mission";

const base = {
  hull: 100,
  battery: 100,
  depth: 3740,
  position: [0, 20, 0],
  sonarFired: false,
  contacts: [],
  samples: [],
};
describe("mission progression", () => {
  it("progresses only when objectives are satisfied", () => {
    expect(progressMission({ status: "running", step: 0 }, base).step).toBe(0);
    expect(
      progressMission({ status: "running", step: 0 }, { ...base, depth: 3760 })
        .step,
    ).toBe(1);
    expect(
      progressMission(
        { status: "running", step: 2 },
        { ...base, sonarFired: true, contacts: ["wreck"] },
      ).step,
    ).toBe(3);
    expect(
      progressMission(
        { status: "running", step: 4 },
        { ...base, samples: ["a", "b", "c"] },
      ).step,
    ).toBe(5);
  });
  it("completes at extraction", () =>
    expect(
      progressMission(
        { status: "running", step: 5 },
        { ...base, position: [-7, 28, 12] },
      ).status,
    ).toBe("complete"));
  it("fails with depleted power or hull", () => {
    expect(
      progressMission({ status: "running", step: 2 }, { ...base, hull: 0 })
        .status,
    ).toBe("failed");
    expect(
      progressMission({ status: "running", step: 2 }, { ...base, battery: 0 })
        .status,
    ).toBe("failed");
  });

  it("can progress through the complete six-step mission", () => {
    let mission = { status: "running", step: 0 };

    mission = progressMission(mission, { ...base, depth: 3760 });
    mission = progressMission(mission, {
      ...base,
      position: [0, 10, -38],
    });
    mission = progressMission(mission, {
      ...base,
      sonarFired: true,
      contacts: ["wreck"],
    });
    mission = progressMission(mission, {
      ...base,
      position: [46, 8, -65],
    });
    mission = progressMission(mission, {
      ...base,
      samples: ["sample-a", "sample-b", "sample-c"],
    });
    mission = progressMission(mission, {
      ...base,
      position: [-7, 28, 12],
    });

    expect(mission).toEqual({ status: "complete", step: 6 });
  });
});
