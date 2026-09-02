import { beforeEach, describe, expect, it } from "vitest";
import { LEVELS } from "../data/levels";
import { constrainPosition, distance3 } from "../simulation/calculations";
import {
  VEHICLE_RADIUS,
  resolveVehicleCollision,
} from "../simulation/collision";
import { buildSolidObjects } from "../simulation/levelRuntime";
import { useSimulationStore } from "../store/useSimulationStore";

const obstacle = {
  id: "test-wreck",
  position: [0, 20, -10],
  radius: 4,
};

describe("collision response", () => {
  const training = LEVELS[0];
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

  it("projects motion along X and Z boundaries and blocks vertical limits", () => {
    const world = training.world;
    const xHit = resolveVehicleCollision(
      [world.xBound - 1, 20, 0],
      [world.xBound + 5, 20, -4],
      [],
      world,
    );
    const zMinHit = resolveVehicleCollision(
      [0, 20, world.zMin + 1],
      [4, 20, world.zMin - 5],
      [],
      world,
    );
    const zMaxHit = resolveVehicleCollision(
      [0, 20, world.zMax - 1],
      [-4, 20, world.zMax + 5],
      [],
      world,
    );
    const floor = constrainPosition([0, -100, 0], world)[1];
    const floorHit = resolveVehicleCollision(
      [0, floor + 1, 0],
      [0, floor - 5, 0],
      [],
      world,
    );
    const ceilingHit = resolveVehicleCollision(
      [0, world.maxY - 1, 0],
      [0, world.maxY + 5, 0],
      [],
      world,
    );

    expect(xHit.position[0]).toBe(world.xBound);
    expect(zMinHit.position[2]).toBe(world.zMin);
    expect(zMaxHit.position[2]).toBe(world.zMax);
    expect(xHit.speedFactor).toBeGreaterThan(0);
    expect(zMinHit.speedFactor).toBeGreaterThan(0);
    expect(floorHit.blockedVertical).toBe(true);
    expect(ceilingHit.position[1]).toBe(world.maxY);
    expect(ceilingHit.blockedVertical).toBe(true);
  });

  it("uses stacked colliders that cover the rendered height of tall rocks", () => {
    const rock = training.rocks.find((item) => item.solid);
    const colliders = buildSolidObjects(training).filter(
      (item) => item.sourceId === rock.id,
    );
    const renderedTop = rock.position[1] + rock.dimensions.halfHeight * 2;
    const colliderTop = Math.max(
      ...colliders.map((item) => item.position[1] + item.radius),
    );

    expect(colliders).toHaveLength(3);
    expect(colliderTop).toBeCloseTo(renderedTop);
  });

  it("resolves a path against multiple nearby colliders", () => {
    const obstacles = [
      { id: "left", position: [0, 20, -4], radius: 3 },
      { id: "right", position: [2, 20, 4], radius: 3 },
    ];
    const result = resolveVehicleCollision(
      [-10, 20, 0],
      [10, 20, 0],
      obstacles,
      training.world,
    );

    expect(result.collided).toBe(true);
    for (const item of obstacles) {
      expect(distance3(result.position, item.position)).toBeGreaterThanOrEqual(
        item.radius + VEHICLE_RADIUS - 0.01,
      );
    }
  });
});
