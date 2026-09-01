import { beforeEach, describe, expect, it } from "vitest";
import { useSimulationStore } from "../store/useSimulationStore";

describe("gameplay feedback", () => {
  beforeEach(() => {
    useSimulationStore.setState({
      levelId: "echoes-of-the-abyss",
      mission: { status: "running", step: 4 },
      showControls: false,
      showSettings: false,
      position: [0, 20, 0],
      samples: [],
      scannedObjects: [],
      discoveredObjects: [
        "beacon-07",
        "abyss-wreck",
        "hull-fracture",
        "data-recorder",
        "biological-trace",
        "abyss-extraction",
      ],
      sonarCooldown: 0,
      battery: 100,
      notice: "",
      noticeTimer: 0,
    });
  });

  it("explains why sonar cannot fire", () => {
    useSimulationStore.setState({ sonarCooldown: 2.4 });

    expect(useSimulationStore.getState().fireSonar()).toBe(false);
    expect(useSimulationStore.getState().notice).toContain("RECHARGING");

    useSimulationStore.setState({ sonarCooldown: 0, battery: 0.5 });
    expect(useSimulationStore.getState().fireSonar()).toBe(false);
    expect(useSimulationStore.getState().notice).toContain("INSUFFICIENT");
  });

  it("reports scan range and confirms a successful sample", () => {
    expect(useSimulationStore.getState().scanNearby()).toBe(false);
    expect(useSimulationStore.getState().notice).toContain("NO ACTIVE TARGET");

    useSimulationStore.setState({ position: [76, 14, -197] });
    expect(useSimulationStore.getState().scanNearby()).toBe(true);
    expect(useSimulationStore.getState().notice).toContain("SCAN COMPLETE");
    expect(useSimulationStore.getState().samples).toContain("hull-fracture");
  });
});
