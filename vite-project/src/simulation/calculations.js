import { SONAR_COOLDOWN, SONAR_RANGE, WORLD } from "./constants";

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// --- Heading and telemetry models ---

// Keep compass headings between 0 and 359 degrees. The double modulo handles
// JavaScript's negative remainder behavior.
export const normalizeHeading = (degrees) => ((degrees % 360) + 360) % 360;

// Approximate water pressure as one additional bar every 10.06 meters.
export const pressureFromDepth = (depth) => 1 + Math.max(0, depth) / 10.06;

// Lower temperature with depth while retaining a safe simulation floor.
export const temperatureFromDepth = (depth) =>
  3.1 - Math.min(2.4, Math.max(0, depth - 3700) * 0.009);

// --- Resource and damage calculations ---

// Energy use combines propulsion, vertical thrust, lights, and sonar. Applying
// `dt` keeps consumption consistent across different frame rates.
export function energyUse({
  speed = 0,
  verticalSpeed = 0,
  lights = 1,
  sonar = false,
  dt = 1,
}) {
  return (
    (Math.abs(speed) * 0.012 +
      Math.abs(verticalSpeed) * 0.018 +
      0.006 +
      lights * 0.014 +
      (sonar ? 0.28 : 0)) *
    dt
  );
}

// Ignore gentle contact and cap a single severe impact at 18 damage points.
export const collisionDamage = (impactSpeed) =>
  clamp((Math.abs(impactSpeed) - 2) * 1.8, 0, 18);
export const clampVitals = ({ battery, hull }) => ({
  battery: clamp(battery, 0, 100),
  hull: clamp(hull, 0, 100),
});
export const distance3 = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const inSonarRange = (a, b, range = SONAR_RANGE) =>
  distance3(a, b) <= range;
export const sonarReady = (cooldown) => cooldown <= 0;
export const tickCooldown = (cooldown, dt) =>
  clamp(cooldown - dt, 0, SONAR_COOLDOWN);
export const seabedHeight = (x, z) =>
  2.5 + Math.sin(x * 0.055) * 1.7 + Math.cos(z * 0.04) * 1.25;

// --- World-space helpers ---

// Keep the vehicle inside the mission area and above the procedural seabed.
export function constrainPosition(position) {
  const [x, y, z] = position;
  const floor = seabedHeight(x, z) + WORLD.minY;
  return [
    clamp(x, -WORLD.bounds, WORLD.bounds),
    clamp(y, floor, WORLD.maxY),
    clamp(z, -WORLD.bounds, 25),
  ];
}

// Convert world coordinates into an angle relative to the vehicle's heading.
export function bearingToContact(origin, headingRadians, target) {
  return (
    Math.atan2(target[0] - origin[0], -(target[2] - origin[2])) - headingRadians
  );
}
