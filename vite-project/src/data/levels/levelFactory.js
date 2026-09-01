import { seabedHeight } from "../../simulation/calculations";

export function getRockDimensions(scale) {
  return {
    horizontalRadius: scale * 3,
    halfHeight: scale * 5.4,
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Generate one deterministic rock layout consumed by rendering and collisions.
function generateRocks(world, count) {
  const random = seededRandom(world.terrainSeed);
  const margin = 18;

  return Array.from({ length: count }, (_, index) => {
    const x =
      -world.xBound + margin + random() * (world.xBound * 2 - margin * 2);
    const z =
      world.zMin + margin + random() * (world.zMax - world.zMin - margin * 2);
    const scale = 0.8 + random() * 2.1;
    const dimensions = getRockDimensions(scale);

    return {
      id: `rock-${world.terrainSeed}-${index}`,
      position: [
        x,
        Math.max(
          world.minY,
          seabedHeight(x, z, world.terrainSeed) + world.minY,
        ),
        z,
      ],
      scale,
      solid: scale >= 1.55,
      dimensions,
    };
  });
}

export function createLevel(config) {
  return {
    ...config,
    rocks: generateRocks(config.world, config.rockCount),
  };
}

export const object = (id, type, label, position, options = {}) => ({
  id,
  type,
  label,
  position,
  radius: options.radius ?? 4,
  scanRange: options.scanRange ?? 10,
  known: options.known ?? type === "target",
  solid: options.solid ?? false,
  hidden: options.hidden ?? false,
  color: options.color,
  visual: options.visual,
  visualScale: options.visualScale,
  effects: options.effects,
});

export const objective = (id, type, title, instruction, key, options = {}) => ({
  id,
  type,
  title,
  instruction,
  key,
  ...options,
});
