import { constrainPosition, distance3 } from "./calculations";

export const VEHICLE_RADIUS = 2.4;

function closestPointOnSegment(start, end, center) {
  const segment = end.map((value, index) => value - start[index]);
  const lengthSquared = segment.reduce((sum, value) => sum + value * value, 0);

  if (lengthSquared === 0) {
    return start;
  }

  const fromStart = center.map((value, index) => value - start[index]);
  const projection = fromStart.reduce(
    (sum, value, index) => sum + value * segment[index],
    0,
  );
  const t = Math.min(1, Math.max(0, projection / lengthSquared));

  return start.map((value, index) => value + segment[index] * t);
}

// --- Lightweight solid-object collision resolution ---

// Sphere colliders protect major objects without a physics engine. If the
// vehicle is already overlapping a collider, only outward motion is allowed.
export function resolveVehicleCollision(
  previousPosition,
  attemptedPosition,
  solidObjects,
  vehicleRadius = VEHICLE_RADIUS,
) {
  const constrained = constrainPosition(attemptedPosition);
  const hitBoundary = constrained.some(
    (value, index) => Math.abs(value - attemptedPosition[index]) > 0.001,
  );

  for (const object of solidObjects) {
    const combinedRadius = object.radius + vehicleRadius;
    const previousDistance = distance3(previousPosition, object.position);
    const attemptedDistance = distance3(constrained, object.position);
    const closest = closestPointOnSegment(
      previousPosition,
      constrained,
      object.position,
    );
    const pathIntersects = distance3(closest, object.position) < combinedRadius;
    const movingOutward =
      previousDistance < combinedRadius && attemptedDistance > previousDistance;

    if (
      (attemptedDistance < combinedRadius || pathIntersects) &&
      !movingOutward
    ) {
      return {
        position: previousPosition,
        collided: true,
        collisionId: object.id,
      };
    }
  }

  return {
    position: constrained,
    collided: hitBoundary,
    collisionId: hitBoundary ? "world-boundary" : null,
  };
}
