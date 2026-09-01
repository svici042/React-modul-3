import { distance3 } from "./calculations";

export function getObjectiveTargetIds(objective) {
  return [
    objective?.targetId,
    objective?.startTargetId,
    objective?.finishTargetId,
    ...(objective?.targetIds ?? []),
  ].filter(Boolean);
}

function horizontalDistanceToSegment(position, start, finish) {
  const segmentX = finish[0] - start[0];
  const segmentZ = finish[2] - start[2];
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  const projection =
    ((position[0] - start[0]) * segmentX +
      (position[2] - start[2]) * segmentZ) /
    lengthSquared;
  const t = Math.min(1, Math.max(0, projection));

  return Math.hypot(
    position[0] - (start[0] + segmentX * t),
    position[2] - (start[2] + segmentZ * t),
  );
}

// Reverse practice is armed only at its start marker. Distance then increases
// solely for negative-speed travel that remains inside the marked corridor.
export function updateReverseObjectiveProgress({
  objective,
  progress,
  level,
  previousPosition,
  position,
  speed,
}) {
  const current =
    progress?.objectiveId === objective.id
      ? progress
      : { objectiveId: objective.id, armed: false, distance: 0 };
  const start = level.objects.find(
    (object) => object.id === objective.startTargetId,
  );
  const finish = level.objects.find(
    (object) => object.id === objective.finishTargetId,
  );

  if (!start || !finish) return current;
  if (!current.armed) {
    return distance3(position, start.position) <= objective.startRange
      ? { ...current, armed: true }
      : current;
  }

  const insideCorridor =
    horizontalDistanceToSegment(position, start.position, finish.position) <=
      objective.corridorWidth &&
    horizontalDistanceToSegment(
      previousPosition,
      start.position,
      finish.position,
    ) <= objective.corridorWidth;
  const reverseTravel =
    speed < -0.35 && insideCorridor ? distance3(previousPosition, position) : 0;

  return { ...current, distance: current.distance + reverseTravel };
}

export function isObjectiveComplete(objective, snapshot) {
  const target = snapshot.level.objects.find(
    (object) => object.id === objective.targetId,
  );

  switch (objective.type) {
    case "move":
      return snapshot.distanceTravelled >= objective.minDistance;
    case "proximity":
      return Boolean(
        target &&
        (!objective.requiresDiscovery ||
          snapshot.discoveredObjects.includes(target.id)) &&
        distance3(snapshot.position, target.position) <= objective.range,
      );
    case "depth":
      return snapshot.depth >= objective.depth;
    case "reverse": {
      const finish = snapshot.level.objects.find(
        (object) => object.id === objective.finishTargetId,
      );

      return Boolean(
        finish &&
        snapshot.objectiveProgress?.objectiveId === objective.id &&
        snapshot.objectiveProgress.armed &&
        snapshot.objectiveProgress.distance >= objective.distance &&
        distance3(snapshot.position, finish.position) <= objective.finishRange,
      );
    }
    case "sonar":
      return (
        snapshot.sonarFired &&
        snapshot.discoveredObjects.includes(objective.targetId)
      );
    case "sonarAll":
      return (
        snapshot.sonarFired &&
        objective.targetIds.every((id) =>
          snapshot.discoveredObjects.includes(id),
        )
      );
    case "scan":
      return snapshot.scannedObjects.includes(objective.targetId);
    case "scanAll":
      return objective.targetIds.every((id) =>
        snapshot.scannedObjects.includes(id),
      );
    default:
      return false;
  }
}

// Advance at most one objective per simulation event to prevent accidental skips.
export function progressObjectives(mission, snapshot) {
  if (snapshot.hull <= 0 || snapshot.battery <= 0) {
    return {
      ...mission,
      status: "failed",
      failureReason:
        snapshot.hull <= 0 ? "Hull integrity depleted" : "Battery depleted",
    };
  }

  if (mission.status !== "running") {
    return mission;
  }

  const objective = snapshot.level.objectives[mission.step];

  if (!objective || !isObjectiveComplete(objective, snapshot)) {
    return mission;
  }

  const nextStep = mission.step + 1;

  if (nextStep >= snapshot.level.objectives.length) {
    return { ...mission, step: nextStep, status: "complete" };
  }

  return { ...mission, step: nextStep };
}
