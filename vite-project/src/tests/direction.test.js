import { describe, expect, it } from "vitest";
import { WORLD } from "../simulation/constants";
import {
  cockpitCameraOffset,
  dampAngle,
  followCameraOffset,
  headingToForward,
  headingToModelYaw,
  integrateVehicleMotion,
  rotateLocalOffset,
} from "../simulation/direction";

const motion = (overrides = {}) =>
  integrateVehicleMotion({
    position: [0, 20, 0],
    heading: 0,
    speed: 0,
    verticalSpeed: 0,
    input: {},
    dt: 1 / 60,
    maxSpeed: WORLD.maxSpeed,
    maxVerticalSpeed: WORLD.maxVerticalSpeed,
    ...overrides,
  });

describe("shared direction convention", () => {
  it.each([
    ["forward-left", 4, { forward: true, left: true }, "decrease"],
    ["forward-right", 4, { forward: true, right: true }, "increase"],
    ["reverse-left", -4, { backward: true, left: true }, "increase"],
    ["reverse-right", -4, { backward: true, right: true }, "decrease"],
  ])("applies intuitive %s steering", (_, speed, input, direction) => {
    const result = motion({ heading: 180, speed, input });

    if (direction === "increase") expect(result.heading).toBeGreaterThan(180);
    else expect(result.heading).toBeLessThan(180);
  });

  it("remembers reverse steering inside the near-zero dead zone", () => {
    const result = motion({
      speed: -0.05,
      movementDirection: -1,
      input: { left: true },
      heading: 180,
    });

    expect(result.heading).toBeGreaterThan(180);
    expect(result.movementDirection).toBe(-1);
  });

  it("uses intended reverse direction while changing through zero", () => {
    const result = motion({
      speed: 0.1,
      movementDirection: 1,
      input: { backward: true, right: true },
      heading: 180,
    });

    expect(result.heading).toBeLessThan(180);
    expect(result.movementDirection).toBe(-1);
  });

  it("moves W at heading 0 toward world -Z", () => {
    const result = motion({ input: { forward: true } });

    expect(result.attemptedPosition[2]).toBeLessThan(0);
    expect(result.attemptedPosition[0]).toBeCloseTo(0, 8);
  });

  it("D turns right and increases compass heading", () => {
    expect(motion({ input: { right: true } }).heading).toBeGreaterThan(0);
  });

  it("A turns left and wraps below zero", () => {
    const result = motion({ heading: 0, input: { left: true } });

    expect(result.heading).toBeGreaterThan(359);
    expect(result.heading).toBeLessThan(360);
  });

  it("model yaw and local bow match the travel direction", () => {
    const forward = headingToForward(90);
    const rotatedBow = rotateLocalOffset([0, 0, -1], 90);

    expect(headingToModelYaw(90)).toBeCloseTo(-Math.PI / 2);
    expect(rotatedBow[0]).toBeCloseTo(forward[0]);
    expect(rotatedBow[2]).toBeCloseTo(forward[2]);
  });

  it("rotates follow and cockpit offsets with heading", () => {
    expect(followCameraOffset(90)).toEqual(
      expect.arrayContaining([expect.closeTo(-14), 7, expect.closeTo(0)]),
    );
    expect(cockpitCameraOffset(90)).toEqual(
      expect.arrayContaining([expect.closeTo(3.4), 1.8, expect.closeTo(0)]),
    );
  });

  it("smooths across 359 to 0 using the shortest path", () => {
    const current = (359 * Math.PI) / 180;
    const target = 0;
    const next = dampAngle(current, target, 10, 1 / 60);

    expect(next).toBeGreaterThan(current);
    expect(next - current).toBeLessThan(0.02);
  });

  it("cancels simultaneous opposite controls", () => {
    const result = motion({
      input: {
        forward: true,
        backward: true,
        left: true,
        right: true,
        ascend: true,
        descend: true,
      },
    });

    expect(result.axes).toEqual({ forward: 0, turn: 0, vertical: 0 });
    expect(result.attemptedPosition).toEqual([0, 20, 0]);
  });

  it("travels approximately equally at 30, 60 and 120 FPS", () => {
    function simulate(fps) {
      let state = {
        position: [0, 20, 0],
        heading: 0,
        speed: 0,
        verticalSpeed: 0,
      };

      for (let frame = 0; frame < fps * 4; frame += 1) {
        const result = motion({
          ...state,
          input: { forward: true },
          dt: 1 / fps,
        });
        state = {
          position: result.attemptedPosition,
          heading: result.heading,
          speed: result.speed,
          verticalSpeed: result.verticalSpeed,
        };
      }

      return Math.abs(state.position[2]);
    }

    const distances = [30, 60, 120].map(simulate);

    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(0.15);
  });
});
