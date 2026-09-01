import { beforeEach, describe, expect, it } from "vitest";
import { resolveVehicleCollision } from "../simulation/collision";
import { useSimulationStore } from "../store/useSimulationStore";

const obstacle = {
  id: "test-wreck",
  position: [0, 20, -10],
  radius: 4,
};

describe("collision response", () => {
  beforeEach(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  it("does not tunnel through a major obstacle", () => {
    const result = resolveVehicleCollision(
      [0, 20, 0],
      [0, 20, -20],
      [obstacle],
    );

    expect(result.collided).toBe(true);
    expect(result.position).toEqual([0, 20, 0]);
  });

  it("allows a vehicle already inside a collider to move outward", () => {
    const result = resolveVehicleCollision(
      [0, 20, -5],
      [0, 20, -3],
      [obstacle],
    );

    expect(result.position).toEqual([0, 20, -3]);
  });

  it("slides along a solid object instead of freezing all movement", () => {
    const previous = [-7, 20, 0];
    const result = resolveVehicleCollision(previous, [7, 20, -10], [obstacle]);

    expect(result.collided).toBe(true);
    expect(result.position).not.toEqual(previous);
    expect(
      Math.hypot(result.position[0], result.position[2] + 10),
    ).toBeGreaterThanOrEqual(6.39);
  });

  it("does not repeatedly damage a stationary overlapping vehicle", () => {
    useSimulationStore.setState({
      levelId: "training-dive",
      mission: { status: "running", step: 1 },
      showControls: false,
      showSettings: false,
      position: [0, 20, 1],
      heading: 0,
      speed: 12,
      verticalSpeed: 0,
      hull: 100,
      battery: 100,
      input: { forward: true },
      activeCollisionId: null,
      collisionCooldown: 0,
      solidObjects: [
        {
          id: "test-impact",
          position: [0, 20, -5],
          radius: 4,
        },
      ],
    });

    useSimulationStore.getState().tick(0.05);
    const hullAfterImpact = useSimulationStore.getState().hull;

    for (let frame = 0; frame < 30; frame += 1) {
      useSimulationStore.getState().tick(0.05);
    }

    expect(hullAfterImpact).toBeLessThan(100);
    expect(useSimulationStore.getState().hull).toBe(hullAfterImpact);
  });
});
