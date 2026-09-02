import { describe, expect, it } from "vitest";
import {
  clampVitals,
  collisionDamage,
  energyUse,
  normalizeHeading,
  pressureFromDepth,
  sonarReady,
  tickCooldown,
} from "../simulation/calculations";

describe("simulation calculations", () => {
  it("calculates external pressure from depth", () =>
    expect(pressureFromDepth(1006)).toBeCloseTo(101, 1));
  it("uses more energy at speed and with lights", () =>
    expect(energyUse({ speed: 10, lights: 2 })).toBeGreaterThan(
      energyUse({ speed: 2, lights: 0 }),
    ));
  it("limits collision damage and ignores gentle contact", () => {
    expect(collisionDamage(1)).toBe(0);
    expect(collisionDamage(100)).toBe(18);
  });
  it("clamps hull and battery", () =>
    expect(clampVitals({ battery: -4, hull: 110 })).toEqual({
      battery: 0,
      hull: 100,
    }));
  it("normalizes heading", () => {
    expect(normalizeHeading(370)).toBe(10);
    expect(normalizeHeading(-10)).toBe(350);
  });
  it("tracks sonar cooldown", () => {
    expect(sonarReady(0)).toBe(true);
    expect(tickCooldown(3, 1)).toBe(2);
    expect(tickCooldown(0.2, 1)).toBe(0);
  });
});
