import { distance3, seabedHeight } from "./calculations";
import { getRockDimensions } from "../data/levels/levelFactory";

export function buildSolidObjects(level) {
  const objectColliders = level.objects.flatMap((object) => {
    if (!object.solid) return [];
    if (object.visual !== "ridge") return [object];

    const dimensions = getRockDimensions(object.visualScale);
    const radius = dimensions.horizontalRadius;
    const centers = [
      object.position[1] + radius,
      object.position[1] + dimensions.halfHeight,
      object.position[1] + dimensions.halfHeight * 2 - radius,
    ];

    return centers.map((y, index) => ({
      id: `${object.id}:${index}`,
      sourceId: object.id,
      position: [object.position[0], y, object.position[2]],
      radius,
    }));
  });
  const rockColliders = level.rocks.flatMap((rock) => {
    if (!rock.solid) return [];

    const dimensions = rock.dimensions ?? getRockDimensions(rock.scale);
    const radius = dimensions.horizontalRadius;
    const bottom = rock.position[1];
    const centers = [
      bottom + radius,
      bottom + dimensions.halfHeight,
      bottom + dimensions.halfHeight * 2 - radius,
    ];

    // Three fitted spheres follow the tall rendered rock without creating one
    // oversized invisible collision volume around its narrow sides.
    return centers.map((y, index) => ({
      id: `${rock.id}:${index}`,
      sourceId: rock.id,
      position: [rock.position[0], y, rock.position[2]],
      radius,
    }));
  });

  return [...objectColliders, ...rockColliders];
}

export function initialDiscoveredObjects(level) {
  return level.objects
    .filter((object) => object.known)
    .map((object) => object.id);
}

export function getTargetTelemetry(
  level,
  objective,
  position,
  heading,
  context = {},
) {
  const scanned = context.scannedObjects ?? [];
  const discovered = context.discoveredObjects ?? [];
  let candidates = [];

  if (objective?.type === "reverse") {
    const targetId = context.objectiveProgress?.armed
      ? objective.finishTargetId
      : objective.startTargetId;
    candidates = level.objects.filter((object) => object.id === targetId);
  } else if (objective?.type === "scanAll") {
    candidates = level.objects.filter(
      (object) =>
        objective.targetIds.includes(object.id) && !scanned.includes(object.id),
    );
  } else if (objective?.type === "sonarAll") {
    candidates = level.objects.filter(
      (object) =>
        objective.targetIds.includes(object.id) &&
        !discovered.includes(object.id),
    );
  } else {
    candidates = level.objects.filter(
      (object) => object.id === objective?.targetId,
    );
  }

  const available = candidates
    .filter((object) => !object.hidden || discovered.includes(object.id))
    .map((object) => ({
      object,
      distance: distance3(position, object.position),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.object.id.localeCompare(right.object.id),
    );
  const target = available[0]?.object;

  if (!target) {
    return {
      target: null,
      distance: null,
      bearing: null,
      requiresDiscovery: candidates.some(
        (object) => object.hidden && !discovered.includes(object.id),
      ),
    };
  }

  const dx = target.position[0] - position[0];
  const dz = target.position[2] - position[2];
  const worldBearing = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
  const relativeBearing = ((worldBearing - heading + 540) % 360) - 180;

  return {
    target,
    distance: distance3(position, target.position),
    bearing: relativeBearing,
    requiresDiscovery: false,
  };
}

export function getTerrainFloor(level, x, z) {
  return Math.max(
    level.world.minY,
    seabedHeight(x, z, level.world.terrainSeed) + level.world.minY,
  );
}

export function getThermalExposure(level, position, dt) {
  const sources = level.objects.filter(
    (object) =>
      object.effects?.thermalRadius > 0 &&
      distance3(position, object.position) < object.effects.thermalRadius,
  );

  return {
    active: sources.length > 0,
    sourceIds: sources.map((object) => object.id),
    energyMultiplier: sources.reduce(
      (maximum, object) =>
        Math.max(maximum, object.effects.energyMultiplier ?? 1),
      1,
    ),
    hullDamage: sources.reduce(
      (total, object) => total + (object.effects.hullDamagePerSecond ?? 0) * dt,
      0,
    ),
  };
}
