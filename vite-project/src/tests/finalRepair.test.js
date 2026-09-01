import { beforeEach, describe, expect, it } from "vitest";
import { LEVELS, validateLevel } from "../data/levels";
import { constrainPosition, distance3 } from "../simulation/calculations";
import {
  VEHICLE_RADIUS,
  resolveVehicleCollision,
} from "../simulation/collision";
import {
  buildSolidObjects,
  getTargetTelemetry,
  getThermalExposure,
} from "../simulation/levelRuntime";
import {
  isObjectiveComplete,
  updateReverseObjectiveProgress,
} from "../simulation/objectives";
import {
  persistCompletedMission,
  useSimulationStore,
} from "../store/useSimulationStore";
import { defaultProgress } from "../utils/progression";

const training = LEVELS[0];
const echoes = LEVELS[1];
const thermal = LEVELS[2];
const blackwater = LEVELS[3];

describe("focused gameplay repairs", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  it("counts reverse travel only after arming inside the marked corridor", () => {
    const objective = training.objectives.find(
      (item) => item.type === "reverse",
    );
    const outside = [80, 12, -128];
    let progress = updateReverseObjectiveProgress({
      objective,
      progress: { objectiveId: "older-objective", armed: true, distance: 99 },
      level: training,
      previousPosition: outside,
      position: [80, 12, -118],
      speed: -5,
    });
    expect(progress).toEqual({
      objectiveId: objective.id,
      armed: false,
      distance: 0,
    });

    const start = training.objects.find(
      (item) => item.id === objective.startTargetId,
    ).position;
    progress = updateReverseObjectiveProgress({
      objective,
      progress,
      level: training,
      previousPosition: start,
      position: start,
      speed: -5,
    });
    expect(progress.armed).toBe(true);

    progress = updateReverseObjectiveProgress({
      objective,
      progress,
      level: training,
      previousPosition: start,
      position: [20, 12, -118],
      speed: 4,
    });
    expect(progress.distance).toBe(0);

    progress = updateReverseObjectiveProgress({
      objective,
      progress,
      level: training,
      previousPosition: start,
      position: [20, 12, -118],
      speed: -4,
    });
    progress = updateReverseObjectiveProgress({
      objective,
      progress,
      level: training,
      previousPosition: [20, 12, -118],
      position: [20, 12, -108],
      speed: -4,
    });

    expect(progress.distance).toBeCloseTo(20);
    expect(
      isObjectiveComplete(objective, {
        level: training,
        position: [20, 12, -108],
        objectiveProgress: progress,
      }),
    ).toBe(true);
  });

  it("resets objective progress on restart and level change", () => {
    useSimulationStore.setState({
      levelId: training.id,
      progress: { ...defaultProgress(), unlocked: [training.id, echoes.id] },
      objectiveProgress: { objectiveId: "reverse", armed: true, distance: 8 },
    });
    useSimulationStore.getState().restart();
    expect(useSimulationStore.getState().objectiveProgress).toBeNull();
    useSimulationStore.setState({
      objectiveProgress: { objectiveId: "reverse", armed: true, distance: 8 },
    });
    useSimulationStore.getState().selectLevel(echoes.id);
    expect(useSimulationStore.getState().objectiveProgress).toBeNull();
  });

  it("moves scanAll guidance to the nearest unresolved discovered record", () => {
    const objective = echoes.objectives.find((item) => item.type === "scanAll");
    const position = [86, 12, -205];
    const discoveredObjects = [...objective.targetIds];
    const first = getTargetTelemetry(echoes, objective, position, 0, {
      discoveredObjects,
      scannedObjects: [],
    });
    const second = getTargetTelemetry(echoes, objective, position, 0, {
      discoveredObjects,
      scannedObjects: [first.target.id],
    });
    const third = getTargetTelemetry(echoes, objective, position, 0, {
      discoveredObjects,
      scannedObjects: [first.target.id, second.target.id],
    });

    expect(
      new Set([first.target.id, second.target.id, third.target.id]).size,
    ).toBe(3);
    expect(
      getTargetTelemetry(echoes, objective, position, 0, {
        discoveredObjects: [],
        scannedObjects: [],
      }),
    ).toMatchObject({ target: null, requiresDiscovery: true });
  });

  it("applies thermal effects only to explicitly configured vents", () => {
    const abyssVent = echoes.objects.find((item) => item.id === "abyss-vent");
    const riftVent = thermal.objects.find((item) => item.id === "vent-a");
    const ridge = blackwater.objects.find(
      (item) => item.id === "blackwater-rock",
    );

    expect(getThermalExposure(echoes, abyssVent.position, 1)).toMatchObject({
      active: true,
      hullDamage: 0.7,
    });
    expect(getThermalExposure(thermal, riftVent.position, 0.5)).toMatchObject({
      active: true,
      hullDamage: 0.35,
    });
    expect(getThermalExposure(blackwater, ridge.position, 1)).toEqual({
      active: false,
      sourceIds: [],
      energyMultiplier: 1,
      hullDamage: 0,
    });
  });

  it("creates sonar emissions only for successful pings and clears them on restart", () => {
    useSimulationStore.setState({
      levelId: training.id,
      mission: { status: "running", step: 0, failureReason: "" },
      showControls: false,
      showSettings: false,
      position: [3, 20, 4],
      sonarCooldown: 0,
      sonarEmission: null,
      battery: 100,
    });
    expect(useSimulationStore.getState().fireSonar()).toBe(true);
    expect(useSimulationStore.getState().sonarEmission).toMatchObject({
      position: [3, 20, 4],
      range: training.sonarRange,
    });
    const emissionId = useSimulationStore.getState().sonarEmission.id;
    useSimulationStore.getState().clearSonarEmission(emissionId + 1);
    expect(useSimulationStore.getState().sonarEmission.id).toBe(emissionId);
    useSimulationStore.getState().clearSonarEmission(emissionId);
    expect(useSimulationStore.getState().sonarEmission).toBeNull();

    useSimulationStore.setState({
      sonarCooldown: 0,
      battery: 100,
    });
    useSimulationStore.getState().fireSonar();
    useSimulationStore.getState().restart();
    expect(useSimulationStore.getState().sonarEmission).toBeNull();
    useSimulationStore.setState({ battery: 0.5, sonarCooldown: 0 });
    expect(useSimulationStore.getState().fireSonar()).toBe(false);
    expect(useSimulationStore.getState().sonarEmission).toBeNull();
  });

  it("projects motion along X and Z boundaries and blocks vertical limits", () => {
    const world = training.world;
    const xHit = resolveVehicleCollision(
      [world.xBound - 1, 20, 0],
      [world.xBound + 5, 20, -4],
      [],
      world,
    );
    const zMinHit = resolveVehicleCollision(
      [0, 20, world.zMin + 1],
      [4, 20, world.zMin - 5],
      [],
      world,
    );
    const zMaxHit = resolveVehicleCollision(
      [0, 20, world.zMax - 1],
      [-4, 20, world.zMax + 5],
      [],
      world,
    );
    const floor = constrainPosition([0, -100, 0], world)[1];
    const floorHit = resolveVehicleCollision(
      [0, floor + 1, 0],
      [0, floor - 5, 0],
      [],
      world,
    );
    const ceilingHit = resolveVehicleCollision(
      [0, world.maxY - 1, 0],
      [0, world.maxY + 5, 0],
      [],
      world,
    );

    expect(xHit.position[0]).toBe(world.xBound);
    expect(zMinHit.position[2]).toBe(world.zMin);
    expect(zMaxHit.position[2]).toBe(world.zMax);
    expect(xHit.speedFactor).toBeGreaterThan(0);
    expect(zMinHit.speedFactor).toBeGreaterThan(0);
    expect(floorHit.blockedVertical).toBe(true);
    expect(ceilingHit.position[1]).toBe(world.maxY);
    expect(ceilingHit.blockedVertical).toBe(true);
  });

  it("uses stacked colliders that cover the rendered height of tall rocks", () => {
    const rock = training.rocks.find((item) => item.solid);
    const colliders = buildSolidObjects(training).filter(
      (item) => item.sourceId === rock.id,
    );
    const renderedTop = rock.position[1] + rock.dimensions.halfHeight * 2;
    const colliderTop = Math.max(
      ...colliders.map((item) => item.position[1] + item.radius),
    );

    expect(colliders).toHaveLength(3);
    expect(colliderTop).toBeCloseTo(renderedTop);
  });

  it("resolves a path against multiple nearby colliders", () => {
    const obstacles = [
      { id: "left", position: [0, 20, -4], radius: 3 },
      { id: "right", position: [2, 20, 4], radius: 3 },
    ];
    const result = resolveVehicleCollision(
      [-10, 20, 0],
      [10, 20, 0],
      obstacles,
      training.world,
    );

    expect(result.collided).toBe(true);
    for (const obstacle of obstacles) {
      expect(
        distance3(result.position, obstacle.position),
      ).toBeGreaterThanOrEqual(obstacle.radius + VEHICLE_RADIUS - 0.01);
    }
  });

  it("returns validation errors for malformed and impossible levels without throwing", () => {
    for (const malformed of [
      null,
      4,
      {},
      { objects: null, objectives: "bad" },
    ]) {
      expect(() => validateLevel(malformed)).not.toThrow();
      expect(validateLevel(malformed).valid).toBe(false);
    }

    const duplicate = structuredClone(training);
    duplicate.objects[1].id = duplicate.objects[0].id;
    duplicate.objectives[1].id = duplicate.objectives[0].id;
    expect(validateLevel(duplicate).errors.join(" ")).toMatch(
      /Duplicate object ID|Duplicate objective ID/,
    );

    const impossible = structuredClone(echoes);
    impossible.objects.find((item) => item.id === "hull-fracture").position = [
      ...impossible.objects.find((item) => item.id === "abyss-wreck").position,
    ];
    expect(validateLevel(impossible).errors.join(" ")).toContain(
      "inside solid collider",
    );
  });

  it("centralizes completion persistence for action-completed objectives", () => {
    const state = {
      mission: { status: "running", step: training.objectives.length - 1 },
      progress: defaultProgress(),
    };
    const progress = persistCompletedMission(
      state,
      training,
      { status: "complete", step: training.objectives.length },
      73,
    );

    expect(progress.completed[training.id]).toBe(true);
    expect(progress.unlocked).toContain(echoes.id);
  });

  it("returns safely to Level 1 selection when progression is reset", () => {
    useSimulationStore.setState({
      levelId: blackwater.id,
      progress: {
        unlocked: LEVELS.map((level) => level.id),
        completed: {},
        bestBattery: {},
      },
      mission: { status: "running", step: 3 },
      input: { forward: true },
      sonarEmission: { id: 4, position: [0, 0, 0], range: 20 },
      objectiveProgress: { objectiveId: "test", armed: true, distance: 5 },
      tutorialReturnStatus: "paused",
      controlsReturnStatus: "running",
    });
    useSimulationStore.getState().resetProgress();
    const state = useSimulationStore.getState();

    expect(state.levelId).toBe(training.id);
    expect(state.mission.status).toBe("select");
    expect(state.input).toEqual({});
    expect(state.sonarEmission).toBeNull();
    expect(state.objectiveProgress).toBeNull();
    expect(state.tutorialReturnStatus).toBeNull();
    expect(state.controlsReturnStatus).toBeNull();
  });
});
