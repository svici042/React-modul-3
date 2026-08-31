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

// Visi sąveikaujantys pasaulio objektai aprašyti vienoje vietoje.
// `position` masyvas visada reiškia Three.js koordinates [x, y, z].
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
    radius: 10,
  },
  {
    id: "vent",
    type: "hazard",
    label: "THERMAL VENT",
    position: [-35, 5, -50],
    radius: 13,
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

// DPR valdo Canvas raišką, particles – jūrinių dalelių skaičių,
// o shadows nurodo, ar brangesnis šešėlių skaičiavimas yra įjungtas.
export const QUALITY = {
  low: { dpr: 1, particles: 260, shadows: false },
  medium: { dpr: 1.5, particles: 620, shadows: false },
  high: { dpr: 2, particles: 1000, shadows: true },
};
export const CAMERA_MODES = ["follow", "cockpit", "orbit"];
