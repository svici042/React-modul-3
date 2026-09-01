import { seabedHeight } from "../../simulation/calculations";
import { blackwaterRecovery } from "./blackwaterRecovery";
import { echoesOfTheAbyss } from "./echoesOfTheAbyss";
import { thermalRift } from "./thermalRift";
import { trainingDive } from "./trainingDive";

export const LEVELS = [
  trainingDive,
  echoesOfTheAbyss,
  thermalRift,
  blackwaterRecovery,
];

export const LEVEL_IDS = LEVELS.map((level) => level.id);

export function getLevel(levelId) {
  return LEVELS.find((level) => level.id === levelId) ?? LEVELS[0];
}

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value) => Number.isFinite(value);
const isPositive = (value) => isFiniteNumber(value) && value > 0;
const isPosition = (value) =>
  Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);

// Validation is total: malformed external data produces actionable errors and
// never throws while attempting to inspect a missing nested field.
export function validateLevel(level) {
  const errors = [];

  if (!isRecord(level)) {
    return { valid: false, errors: ["Level must be an object."] };
  }

  const world = isRecord(level.world) ? level.world : null;
  const start = isRecord(level.start) ? level.start : null;
  const objects = Array.isArray(level.objects) ? level.objects : [];
  const objectives = Array.isArray(level.objectives) ? level.objectives : [];

  if (typeof level.id !== "string" || !level.id.trim())
    errors.push("Level ID is missing.");
  if (typeof level.title !== "string" || !level.title.trim())
    errors.push("Level title is missing.");
  if (!world) errors.push("World configuration is missing.");
  if (!start) errors.push("Starting configuration is missing.");
  if (!Array.isArray(level.objects)) errors.push("Objects must be an array.");
  if (!Array.isArray(level.objectives) || objectives.length === 0)
    errors.push("Objectives must be a non-empty array.");
  if (!isPositive(level.sonarRange))
    errors.push("Sonar range must be positive.");

  const worldValid =
    world &&
    isPositive(world.xBound) &&
    isFiniteNumber(world.zMin) &&
    isFiniteNumber(world.zMax) &&
    world.zMin < world.zMax &&
    isFiniteNumber(world.minY) &&
    isFiniteNumber(world.maxY) &&
    world.minY < world.maxY;

  if (world && !worldValid)
    errors.push("World bounds must be finite and ordered.");
  if (world && !isFiniteNumber(world.terrainSeed))
    errors.push("Terrain seed must be finite.");
  if (world && !isPositive(world.terrainSize))
    errors.push("Terrain size must be positive.");
  if (worldValid && isPositive(world.terrainSize)) {
    if (world.terrainSize < world.xBound * 2 + 20)
      errors.push("Terrain does not cover the configured X bounds.");
    if (world.terrainSize < world.zMax - world.zMin + 20)
      errors.push("Terrain does not cover the configured Z bounds.");
  }

  function validatePosition(position, label, requireTerrainClearance = false) {
    if (!isPosition(position)) {
      errors.push(`${label} position must contain three finite numbers.`);
      return;
    }
    if (!worldValid) return;

    const [x, y, z] = position;
    if (Math.abs(x) > world.xBound || z < world.zMin || z > world.zMax)
      errors.push(`${label} is outside horizontal world bounds.`);
    if (y < world.minY || y > world.maxY)
      errors.push(`${label} is outside vertical world bounds.`);
    if (requireTerrainClearance) {
      const floor = Math.max(
        world.minY,
        seabedHeight(x, z, world.terrainSeed) + world.minY,
      );
      if (y < floor) errors.push(`${label} starts below the terrain floor.`);
    }
  }

  validatePosition(start?.position, "Start", true);
  if (start && !isFiniteNumber(start.heading))
    errors.push("Starting heading must be finite.");
  if (
    start &&
    (!isFiniteNumber(start.battery) ||
      !isFiniteNumber(start.hull) ||
      start.battery < 0 ||
      start.battery > 100 ||
      start.hull < 0 ||
      start.hull > 100)
  )
    errors.push("Starting battery and hull must be within 0–100.");

  const objectIds = new Set();
  const validObjects = [];
  for (const [index, object] of objects.entries()) {
    if (!isRecord(object)) {
      errors.push(`Object ${index} must be an object.`);
      continue;
    }
    if (typeof object.id !== "string" || !object.id.trim())
      errors.push(`Object ${index} has no valid ID.`);
    else if (objectIds.has(object.id))
      errors.push(`Duplicate object ID ${object.id}.`);
    else objectIds.add(object.id);
    validatePosition(object.position, `Object ${object.id ?? index}`);
    if (!isPositive(object.radius))
      errors.push(`Object ${object.id ?? index} radius must be positive.`);
    if (object.visual === "ridge" && !isPositive(object.visualScale))
      errors.push(
        `Object ${object.id ?? index} visual scale must be positive.`,
      );

    if (object.effects !== undefined) {
      if (!isRecord(object.effects))
        errors.push(`Object ${object.id ?? index} effects must be an object.`);
      else {
        for (const field of [
          "thermalRadius",
          "energyMultiplier",
          "hullDamagePerSecond",
        ]) {
          if (!isPositive(object.effects[field]))
            errors.push(`Object ${object.id ?? index} has invalid ${field}.`);
        }
      }
    }
    validObjects.push(object);
  }

  const objectiveIds = new Set();
  const supportedTypes = new Set([
    "move",
    "proximity",
    "depth",
    "reverse",
    "sonar",
    "sonarAll",
    "scan",
    "scanAll",
  ]);
  for (const [index, objective] of objectives.entries()) {
    if (!isRecord(objective)) {
      errors.push(`Objective ${index} must be an object.`);
      continue;
    }
    if (typeof objective.id !== "string" || !objective.id.trim())
      errors.push(`Objective ${index} has no valid ID.`);
    else if (objectiveIds.has(objective.id))
      errors.push(`Duplicate objective ID ${objective.id}.`);
    else objectiveIds.add(objective.id);
    if (!supportedTypes.has(objective.type))
      errors.push(
        `Objective ${objective.id ?? index} has an unsupported type.`,
      );
    if (
      typeof objective.instruction !== "string" ||
      !objective.instruction.trim()
    )
      errors.push(`Objective ${objective.id ?? index} needs an instruction.`);

    const singleTargetTypes = new Set(["proximity", "sonar", "scan"]);
    if (
      singleTargetTypes.has(objective.type) &&
      !objectIds.has(objective.targetId)
    )
      errors.push(
        `Objective ${objective.id ?? index} references a missing target.`,
      );
    if (["sonarAll", "scanAll"].includes(objective.type)) {
      if (
        !Array.isArray(objective.targetIds) ||
        objective.targetIds.length === 0
      )
        errors.push(`Objective ${objective.id ?? index} needs target IDs.`);
      else
        for (const targetId of objective.targetIds)
          if (!objectIds.has(targetId))
            errors.push(
              `Objective ${objective.id ?? index} references missing ${targetId}.`,
            );
    }
    if (
      ["proximity", "scan", "scanAll"].includes(objective.type) &&
      !isPositive(objective.range)
    )
      errors.push(`Objective ${objective.id ?? index} range must be positive.`);
    if (objective.type === "move" && !isPositive(objective.minDistance))
      errors.push(
        `Objective ${objective.id ?? index} distance must be positive.`,
      );
    if (objective.type === "depth" && !isFiniteNumber(objective.depth))
      errors.push(`Objective ${objective.id ?? index} depth must be finite.`);
    if (objective.type === "reverse") {
      for (const targetId of [
        objective.startTargetId,
        objective.finishTargetId,
      ])
        if (!objectIds.has(targetId))
          errors.push(
            `Objective ${objective.id ?? index} references a missing reverse marker.`,
          );
      for (const field of [
        "distance",
        "startRange",
        "finishRange",
        "corridorWidth",
      ])
        if (!isPositive(objective[field]))
          errors.push(
            `Objective ${objective.id ?? index} has invalid ${field}.`,
          );
    }
  }

  if (!objectIds.has(level.extractionId))
    errors.push("The extraction object is missing.");

  // A scan target embedded inside another solid object's volume is impossible
  // to reach because the vehicle collider is stopped before scan range.
  const scanTargetIds = new Set(
    objectives
      .filter((objective) => ["scan", "scanAll"].includes(objective?.type))
      .flatMap((objective) => [
        objective.targetId,
        ...(objective.targetIds ?? []),
      ])
      .filter(Boolean),
  );
  for (const target of validObjects.filter(
    (object) => scanTargetIds.has(object.id) && isPosition(object.position),
  )) {
    for (const solid of validObjects.filter(
      (object) =>
        object.solid &&
        object.id !== target.id &&
        isPosition(object.position) &&
        isPositive(object.radius),
    )) {
      if (
        Math.hypot(
          ...target.position.map((value, axis) => value - solid.position[axis]),
        ) < solid.radius
      )
        errors.push(
          `Scan target ${target.id} is inside solid collider ${solid.id}.`,
        );
    }
  }

  return { valid: errors.length === 0, errors };
}

for (const level of LEVELS) {
  const validation = validateLevel(level);
  if (!validation.valid)
    throw new Error(
      `Invalid level ${level.id}: ${validation.errors.join(" ")}`,
    );
}
