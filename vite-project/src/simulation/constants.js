export const WORLD = {
  bounds: 120,
  minY: 5,
  maxY: 54,
  surfaceDepth: 3740,
  maxSpeed: 12,
  maxVerticalSpeed: 6,
};
export const SONAR_RANGE = 78;
export const SONAR_COOLDOWN = 6;

// --- Shared procedural world layout ---

// Use the same X/Z rock layout in rendering and collision calculations.
export const ROCKS = Array.from({ length: 24 }, (_, index) => ({
  id: `rock-${index}`,
  x: ((index * 37) % 190) - 95,
  z: -((index * 53) % 130),
  scale: 1 + (index % 5) * 0.42,
}));

// Define every interactive world object in one place. Position arrays always
// use Three.js world coordinates in [x, y, z] order.
export const OBJECTS = [
  {
    id: "beacon",
    type: "target",
    label: "NAV BEACON 07",
    position: [0, 10, -38],
    radius: 4,
  },
  {
    id: "wreck",
    type: "unknown",
    label: "UNIDENTIFIED SIGNAL",
    position: [46, 8, -74],
    radius: 7,
    solid: true,
  },
  {
    id: "vent",
    type: "hazard",
    label: "THERMAL VENT",
    position: [-35, 5, -50],
    radius: 9,
    solid: true,
  },
  {
    id: "sample-a",
    type: "sample",
    label: "HULL FRACTURE",
    position: [39, 9, -69],
    radius: 4,
  },
  {
    id: "sample-b",
    type: "sample",
    label: "DATA RECORDER",
    position: [50, 7, -78],
    radius: 4,
  },
  {
    id: "sample-c",
    type: "sample",
    label: "BIOLOGICAL TRACE",
    position: [43, 12, -84],
    radius: 4,
  },
  {
    id: "extraction",
    type: "target",
    label: "EXTRACTION BEACON",
    position: [-7, 28, 12],
    radius: 5,
  },
];

// --- Rendering profiles ---

// DPR controls Canvas resolution, particles controls marine-snow density, and
// shadows decides whether the more expensive shadow pass is enabled.
export const QUALITY = {
  low: { dpr: 1, particles: 260, shadows: false },
  medium: { dpr: 1.5, particles: 620, shadows: false },
  high: { dpr: 2, particles: 1000, shadows: true },
};
export const CAMERA_MODES = ["follow", "cockpit", "orbit"];
