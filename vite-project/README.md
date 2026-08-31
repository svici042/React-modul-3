# Deep Sea Control

Deep Sea Control is a cinematic, browser-based educational submersible simulator. Pilot the **Nereid VII** through a procedurally built trench, use active sonar to locate a wreck, archive three research samples, and return to extraction.

## Features

- Interactive React Three Fiber ocean trench with procedural terrain, rocks, marine snow, bubbles, fog, searchlights, a wreck, thermal vent, beacons, and sonar pulse
- Inertial, frame-rate-independent movement with seabed/world boundaries and collision damage
- Follow, cockpit, and orbit inspection cameras
- Connected telemetry for depth, heading, speed, pressure, temperature, battery, hull, lights, sonar, and mission progress
- Six-step playable **Echoes of the Abyss** mission with science log, event stream, completion, failure, and restart states
- Circular world-connected sonar with range, direction, classification, energy cost, cooldown, and opt-in audio
- Three graphics presets, responsive tablet/touch controls, and reduced-motion support
- Keyboard-operable dialogs, visible focus, semantic labels, critical text alerts, and a non-visual status summary

## Screenshot

> Add a production screenshot here after deployment.

## Controls

| Input               | Action                                   |
| ------------------- | ---------------------------------------- |
| `W` / `S` or arrows | Forward / reverse thrust                 |
| `A` / `D` or arrows | Turn left / right                        |
| `Q` / `E`           | Descend / ascend                         |
| `Space`             | Stabilize / stop                         |
| `C`                 | Cycle follow, cockpit, and orbit cameras |
| `F`                 | Cycle searchlights off, low, high        |
| `R`                 | Active sonar ping                        |
| `X`                 | Scan a nearby data point                 |
| `Esc`               | Pause / resume                           |
| Mouse drag          | Inspect in orbit camera mode             |

## Run locally

```bash
npm install
npm run dev
```

From the parent directory, `npm start` also launches this project. Validation commands are `npm run build`, `npm test`, `npm run lint`, and `npm run preview`.

Use `npm run format` to format the project automatically. `npm run format:check` verifies formatting without changing files.

## Architecture

- `scene/` owns Three.js/R3F rendering and camera behavior.
- `store/` is the authoritative Zustand simulation state and frame tick.
- `simulation/` contains pure constants, telemetry, collision, sonar, and mission logic.
- `components/hud/` renders instruments and interactive controls.
- `components/ui/` contains mission/settings/controls dialogs.
- `hooks/` owns keyboard input lifecycle and cleanup.
- `utils/` safely reads and writes user preferences.
- `tests/` covers pure simulation logic and primary interface states.

The model is deliberately simplified: depth is derived from local Y position, pressure uses roughly one atmosphere per 10.06 metres, temperature attenuates with depth, and energy use combines propulsion, vertical thrust, systems, lights, and sonar. It is educational, not suitable for real navigation or engineering.

## Graphics, accessibility, and assets

Quality presets cap pixel density and adjust particles, antialiasing, and shadows. Preferences are stored defensively in `localStorage`. Reduced motion honors both the app setting and `prefers-reduced-motion`. All 3D geometry, materials, interface graphics, and effects are original procedural code. System fonts and procedural assets keep the simulator independent of runtime asset servers.

## Known limitations

- Physics and telemetry are illustrative rather than scientifically certified.
- Collision uses practical bounds and hazard radii, not triangle-level mesh collision.
- Sonar audio begins only after a button interaction due to browser autoplay rules.
- Very small portrait screens use a compact HUD; landscape tablet or desktop is recommended.
