import { normalizeHeading } from "./calculations";

const TAU = Math.PI * 2;

export const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;

// --- Compass and orientation conversion ---

// Compass convention: 0° points toward -Z (north) and 90° toward +X (east).
export function headingToForward(heading) {
  const radians = degreesToRadians(heading);

  return [Math.sin(radians), 0, -Math.cos(radians)];
}

// A Three.js object's local forward axis is -Z, so compass headings require the
// opposite sign when applied as a Y-axis model rotation.
export const headingToModelYaw = (heading) => -degreesToRadians(heading);

// Rotate camera offsets from vehicle-local space into world space.
export function rotateLocalOffset(offset, heading) {
  const radians = degreesToRadians(heading);
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const [x, y, z] = offset;

  return [x * cos - z * sin, y, x * sin + z * cos];
}

export const followCameraOffset = (heading) =>
  rotateLocalOffset([0, 7, 14], heading);

export const cockpitCameraOffset = (heading) =>
  rotateLocalOffset([0, 1.8, -3.4], heading);

// --- Frame-rate-independent smoothing ---

// Return the shortest angular path in the [-PI, PI] interval.
export function shortestAngleDelta(current, target) {
  return ((((target - current + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

// Exponential damping behaves consistently at 30, 60, and 120 FPS.
export function damp(current, target, responsiveness, dt) {
  const alpha = 1 - Math.exp(-responsiveness * dt);

  return current + (target - current) * alpha;
}

export function dampAngle(current, target, responsiveness, dt) {
  const alpha = 1 - Math.exp(-responsiveness * dt);

  return current + shortestAngleDelta(current, target) * alpha;
}

export function integrateVehicleMotion({
  position,
  heading,
  speed,
  verticalSpeed,
  input,
  dt,
  disabled = false,
  maxSpeed,
  maxVerticalSpeed,
}) {
  const forwardAxis = disabled
    ? 0
    : Number(Boolean(input.forward)) - Number(Boolean(input.backward));
  const turnAxis = disabled
    ? 0
    : Number(Boolean(input.right)) - Number(Boolean(input.left));
  const verticalAxis = disabled
    ? 0
    : Number(Boolean(input.ascend)) - Number(Boolean(input.descend));

  const nextSpeed = damp(
    speed,
    forwardAxis * maxSpeed,
    forwardAxis ? 1.8 : 3.2,
    dt,
  );
  const nextVerticalSpeed = damp(
    verticalSpeed,
    verticalAxis * maxVerticalSpeed,
    verticalAxis ? 2.2 : 3.6,
    dt,
  );
  const turnRate = 34 + (Math.abs(nextSpeed) / maxSpeed) * 32;
  const nextHeading = normalizeHeading(heading + turnAxis * turnRate * dt);
  const forward = headingToForward(nextHeading);

  // Average the previous and next velocities so traveled distance depends less
  // on the physics step size.
  const averageSpeed = (speed + nextSpeed) / 2;
  const averageVerticalSpeed = (verticalSpeed + nextVerticalSpeed) / 2;

  return {
    heading: nextHeading,
    speed: nextSpeed,
    verticalSpeed: nextVerticalSpeed,
    attemptedPosition: [
      position[0] + forward[0] * averageSpeed * dt,
      position[1] + averageVerticalSpeed * dt,
      position[2] + forward[2] * averageSpeed * dt,
    ],
    axes: {
      forward: forwardAxis,
      turn: turnAxis,
      vertical: verticalAxis,
    },
  };
}
