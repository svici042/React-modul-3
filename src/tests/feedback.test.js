import { beforeEach, describe, expect, it } from "vitest";
import { LEVELS } from "../data/levels";
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

  it("creates sonar emissions only for successful pings and clears them", () => {
    const training = LEVELS[0];
    useSimulationStore.setState({
      levelId: training.id,
      mission: { status: "running", step: 0, failureReason: "" },
      position: [3, 20, 4],
      sonarCooldown: 0,
      sonarEmission: null,
      battery: 100,
    });

    expect(useSimulationStore.getState().fireSonar()).toBe(true);
    expect(useSimulationStore.getState().sonarEmission).toMatchObject({
      position: [3, 20, 4],
      range: training.sonarRange,
    });
    const emissionId = useSimulationStore.getState().sonarEmission.id;
    useSimulationStore.getState().clearSonarEmission(emissionId + 1);
    expect(useSimulationStore.getState().sonarEmission.id).toBe(emissionId);
    useSimulationStore.getState().clearSonarEmission(emissionId);
    expect(useSimulationStore.getState().sonarEmission).toBeNull();

    useSimulationStore.setState({ battery: 0.5, sonarCooldown: 0 });
    expect(useSimulationStore.getState().fireSonar()).toBe(false);
    expect(useSimulationStore.getState().sonarEmission).toBeNull();
  });
});
