import { constrainPosition, distance3 } from "./calculations";

export const VEHICLE_RADIUS = 2.4;
const MAX_RESOLUTION_PASSES = 4;

function subtract(left, right) {
  return left.map((value, index) => value - right[index]);
}

function add(left, right) {
  return left.map((value, index) => value + right[index]);
}

function dot(left, right) {
  return left.reduce((total, value, index) => total + value * right[index], 0);
}

function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function closestPointOnSegment(start, end, center) {
  const segment = subtract(end, start);
  const lengthSquared = dot(segment, segment);

  if (lengthSquared === 0) return start;

  const t = Math.min(
    1,
    Math.max(0, dot(subtract(center, start), segment) / lengthSquared),
  );
  return start.map((value, index) => value + segment[index] * t);
}

function boundaryResponse(previous, attempted, world) {
  const position = constrainPosition(attempted, world);
  const clampedAxes = position.map(
    (value, index) => Math.abs(value - attempted[index]) > 0.001,
  );
  const attemptedHorizontal = Math.hypot(
    attempted[0] - previous[0],
    attempted[2] - previous[2],
  );
  const resolvedHorizontal = Math.hypot(
    position[0] - previous[0],
    position[2] - previous[2],
  );
  const horizontalFactor =
    attemptedHorizontal > 0
      ? Math.min(1, resolvedHorizontal / attemptedHorizontal)
      : 1;
  const blockedVertical = clampedAxes[1];

  return {
    position,
    collided: clampedAxes.some(Boolean),
    collisionId: clampedAxes.some(Boolean) ? "world-boundary" : null,
    impactFactor: clampedAxes.some(Boolean)
      ? Math.max(1 - horizontalFactor, blockedVertical ? 1 : 0)
      : 0,
    speedFactor: horizontalFactor,
    blockedVertical,
  };
}

function resolveSphere(start, candidate, object, vehicleRadius) {
  const combinedRadius = object.radius + vehicleRadius;
  const startDistance = distance3(start, object.position);
  const candidateDistance = distance3(candidate, object.position);
  const closest = closestPointOnSegment(start, candidate, object.position);
  const pathIntersects = distance3(closest, object.position) < combinedRadius;
  const movingOutward =
    startDistance < combinedRadius && candidateDistance > startDistance;

  if (
    movingOutward ||
    (candidateDistance >= combinedRadius && !pathIntersects)
  ) {
    return null;
  }

  const movement = subtract(candidate, start);
  const movementLength = Math.hypot(...movement);
  const normal = normalize(subtract(start, object.position));
  const inwardComponent = Math.min(0, dot(movement, normal));
  const slide = movement.map(
    (value, index) => value - normal[index] * inwardComponent,
  );
  let position = add(start, slide);

  // Push a tangent candidate to the surface when curvature leaves it inside.
  if (distance3(position, object.position) < combinedRadius) {
    const pushNormal = normalize(subtract(position, object.position));
    position = object.position.map(
      (value, index) => value + pushNormal[index] * combinedRadius,
    );
  }

  return {
    position,
    impactFactor:
      movementLength > 0
        ? Math.min(1, Math.max(0, -inwardComponent / movementLength))
        : 0,
  };
}

// Resolve a bounded number of contacts so a slide from one rock cannot finish
// inside a neighboring collider in dense fields.
export function resolveVehicleCollision(
  previousPosition,
  attemptedPosition,
  solidObjects,
  world,
  vehicleRadius = VEHICLE_RADIUS,
) {
  const boundary = boundaryResponse(previousPosition, attemptedPosition, world);
  let position = boundary.position;
  let collisionId = boundary.collisionId;
  let impactFactor = boundary.impactFactor;
  let collided = boundary.collided;

  for (let pass = 0; pass < MAX_RESOLUTION_PASSES; pass += 1) {
    let resolvedThisPass = false;

    for (const object of solidObjects) {
      const resolution = resolveSphere(
        previousPosition,
        position,
        object,
        vehicleRadius,
      );

      if (!resolution) continue;
      position = resolution.position;
      collisionId ??= object.sourceId ?? object.id;
      impactFactor = Math.max(impactFactor, resolution.impactFactor);
      collided = true;
      resolvedThisPass = true;
    }

    if (!resolvedThisPass) break;
  }

  const finalBoundary = boundaryResponse(previousPosition, position, world);

  return {
    position: finalBoundary.position,
    collided: collided || finalBoundary.collided,
    collisionId: collisionId ?? finalBoundary.collisionId,
    impactFactor: Math.max(impactFactor, finalBoundary.impactFactor),
    speedFactor: Math.min(
      boundary.speedFactor,
      finalBoundary.speedFactor,
      1 - impactFactor,
    ),
    blockedVertical: boundary.blockedVertical || finalBoundary.blockedVertical,
  };
}
