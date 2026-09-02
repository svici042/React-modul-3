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

// --- Rendering profiles ---

// DPR controls Canvas resolution, particles controls marine-snow density, and
// shadows decides whether the more expensive shadow pass is enabled.
export const QUALITY = {
  low: { dpr: 1, particles: 260, shadows: false },
  medium: { dpr: 1.5, particles: 620, shadows: false },
  high: { dpr: 2, particles: 1000, shadows: true },
};
export const CAMERA_MODES = ["follow", "cockpit", "orbit"];
