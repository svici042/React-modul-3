import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { QUALITY } from "../simulation/constants";
import { seabedHeight } from "../simulation/calculations";
import { getRockDimensions } from "../data/levels/levelFactory";
import {
  cockpitCameraOffset,
  dampAngle,
  followCameraOffset,
  headingToForward,
  headingToModelYaw,
} from "../simulation/direction";
import {
  selectCurrentLevel,
  useSimulationStore,
} from "../store/useSimulationStore";

const pseudoRandom = (index) => {
  const value = Math.sin(index * 999.91) * 43758.5453;
  return value - Math.floor(value);
};

// --- Procedural seabed and ambient particles ---

function Terrain({ level }) {
  const centerZ = (level.world.zMin + level.world.zMax) / 2;

  // Generate the seabed once. Frames update moving-object transforms instead
  // of rebuilding static geometry.
  const geometry = useMemo(() => {
    const segments = level.world.terrainSize > 600 ? 62 : 52;
    const geo = new THREE.PlaneGeometry(
      level.world.terrainSize,
      level.world.terrainSize,
      segments,
      segments,
    );
    geo.rotateX(-Math.PI / 2);
    const attr = geo.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      attr.setY(
        i,
        Math.max(
          level.world.minY,
          seabedHeight(
            attr.getX(i),
            attr.getZ(i) + centerZ,
            level.world.terrainSeed,
          ) + level.world.minY,
        ),
      );
    }
    geo.computeVertexNormals();
    return geo;
  }, [centerZ, level]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={[0, 0, centerZ]} receiveShadow>
      <meshStandardMaterial color="#071b20" roughness={0.96} metalness={0.08} />
    </mesh>
  );
}

function Rock({ position, scale = 1 }) {
  const { halfHeight } = getRockDimensions(scale);

  return (
    <mesh
      position={[position[0], position[1] + halfHeight, position[2]]}
      scale={[scale, scale * 1.8, scale]}
      castShadow
      receiveShadow
      rotation={[0.1, position[0], 0.2]}
    >
      <dodecahedronGeometry args={[3, 1]} />
      <meshStandardMaterial color="#0a2228" roughness={0.88} />
    </mesh>
  );
}

function MarineSnow({ count }) {
  const ref = useRef();

  // Deterministic positions remain stable across React re-renders.
  const positions = useMemo(
    () =>
      Float32Array.from(
        { length: count * 3 },
        (_, i) => (pseudoRandom(i) - 0.5) * (i % 3 === 1 ? 62 : 170),
      ),
    [count],
  );
  useFrame((_, dt) => {
    if (!ref.current) return;
    const position = useSimulationStore.getState().position;
    ref.current.position.set(position[0], position[1], position[2]);
    ref.current.rotation.y += dt * 0.008;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#7edfe0"
        size={0.09}
        transparent
        opacity={0.42}
        depthWrite={false}
      />
    </points>
  );
}

// --- Submersible model and vehicle-local effects ---

function Submersible() {
  const group = useRef();
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const lights = useSimulationStore((s) => s.lights);
  const initial = useSimulationStore.getState();

  // Exponential damping feels consistent across frame rates. A negative Y
  // rotation aligns the Three.js -Z bow with the compass heading convention.
  useFrame((_, dt) => {
    if (!group.current) return;
    const { position, heading } = useSimulationStore.getState();

    desiredPosition.set(...position);
    group.current.position.lerp(
      desiredPosition,
      1 - Math.exp(-14 * Math.min(dt, 0.05)),
    );
    group.current.rotation.y = dampAngle(
      group.current.rotation.y,
      headingToModelYaw(heading),
      12,
      Math.min(dt, 0.05),
    );
  });
  return (
    <group ref={group} position={initial.position}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]} scale={[1.8, 1.8, 3.2]}>
        <capsuleGeometry args={[1.15, 2.3, 8, 18]} />
        <meshStandardMaterial
          color="#b4a568"
          roughness={0.46}
          metalness={0.68}
        />
      </mesh>
      <mesh position={[0, 1.15, 0.3]} castShadow>
        <sphereGeometry args={[0.92, 24, 16]} />
        <meshPhysicalMaterial
          color="#173940"
          metalness={0.5}
          roughness={0.12}
          transmission={0.18}
        />
      </mesh>
      <mesh position={[0, 1.75, 0.2]}>
        <cylinderGeometry args={[0.35, 0.5, 0.65, 14]} />
        <meshStandardMaterial color="#807748" metalness={0.65} />
      </mesh>
      <mesh position={[-2.3, 0, 0.4]} scale={[2.8, 0.16, 1.05]}>
        <boxGeometry />
        <meshStandardMaterial color="#746b42" metalness={0.6} />
      </mesh>
      <mesh position={[2.3, 0, 0.4]} scale={[2.8, 0.16, 1.05]}>
        <boxGeometry />
        <meshStandardMaterial color="#746b42" metalness={0.6} />
      </mesh>
      {[
        [-0.72, 0.2, -2.6],
        [0.72, 0.2, -2.6],
      ].map((p, i) => (
        <group key={i} position={p}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 0.55, 12]} />
            <meshStandardMaterial color="#15252a" metalness={0.8} />
          </mesh>
          {lights > 0 && <Headlight intensity={lights === 2 ? 45 : 25} />}
        </group>
      ))}
      <Bubbles />
    </group>
  );
}

function Headlight({ intensity }) {
  const light = useRef();
  const target = useRef();

  // A local target inherits vehicle rotation, keeping each beam aligned with
  // the bow instead of pointing toward a fixed world-space origin.
  useEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
  }, []);

  return (
    <>
      <spotLight
        ref={light}
        color={intensity > 30 ? "#d9ffff" : "#83e5e6"}
        intensity={intensity}
        angle={0.28}
        penumbra={0.75}
        distance={55}
        castShadow
      />
      <object3D ref={target} position={[0, -2, -30]} />
    </>
  );
}

function Bubbles() {
  const ref = useRef();
  const points = useMemo(
    () =>
      Float32Array.from({ length: 36 }, (_, i) =>
        i % 3 === 0
          ? pseudoRandom(i) - 0.5
          : i % 3 === 1
            ? pseudoRandom(i) * 3
            : 2 + pseudoRandom(i) * 5,
      ),
    [],
  );
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.position.y += dt * 0.32;
      if (ref.current.position.y > 3) ref.current.position.y = 0;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.12} color="#b9ffff" transparent opacity={0.48} />
    </points>
  );
}

// --- Mission objects and world-space markers ---

function Beacon({ object, revealed, identified }) {
  const color =
    object.type === "hazard"
      ? "#e99b4a"
      : object.type === "unknown" || object.type === "sample"
        ? "#8bdce0"
        : "#55f0d0";
  return (
    <group position={object.position}>
      {object.visual === "thermalVent" ? (
        <>
          <Rock position={[0, 0, 0]} scale={3} />
          <pointLight color={object.color} intensity={20} distance={18} />
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[(i - 1) * 2.2, 4 + i, 0]}>
              <coneGeometry args={[1.1, 6, 10]} />
              <meshStandardMaterial
                color="#391d15"
                emissive="#6d2011"
                emissiveIntensity={0.4}
              />
            </mesh>
          ))}
        </>
      ) : object.visual === "ridge" ? (
        <Rock position={[0, 0, 0]} scale={object.visualScale} />
      ) : ["wreck", "drone"].includes(object.type) ? (
        <Wreck />
      ) : (
        <>
          <mesh>
            <cylinderGeometry args={[0.35, 0.7, 5, 10]} />
            <meshStandardMaterial color="#263d40" metalness={0.75} />
          </mesh>
          <mesh position={[0, 2.8, 0]}>
            <sphereGeometry args={[0.35, 12, 8]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <pointLight
            position={[0, 2.8, 0]}
            color={color}
            intensity={8}
            distance={12}
          />
        </>
      )}
      {revealed && (
        <Html
          center
          distanceFactor={13}
          position={[0, 5, 0]}
          className="world-label"
        >
          <span>{identified ? object.label : "UNKNOWN CONTACT"}</span>
        </Html>
      )}
    </group>
  );
}

function Wreck() {
  return (
    <group rotation={[0.15, -0.65, -0.08]}>
      <mesh scale={[4.6, 1.25, 1.8]}>
        <boxGeometry />
        <meshStandardMaterial
          color="#182a2b"
          roughness={0.72}
          metalness={0.82}
        />
      </mesh>
      <mesh position={[0, 1.25, 0]} scale={[1.8, 0.55, 1.2]}>
        <boxGeometry />
        <meshStandardMaterial color="#112124" metalness={0.75} />
      </mesh>
      <mesh position={[-4.2, 0, 0]} scale={[4, 0.12, 1.4]}>
        <boxGeometry />
        <meshStandardMaterial color="#25393a" metalness={0.8} />
      </mesh>
    </group>
  );
}

// --- Sonar visualization and camera controllers ---

function SonarPulse() {
  const emission = useSimulationStore((s) => s.sonarEmission);
  const reducedMotion = useSimulationStore((s) => s.preferences.reducedMotion);
  const ref = useRef();
  const material = useRef();
  const elapsed = useRef(0);
  const activeId = useRef(null);

  useFrame((_, dt) => {
    if (!emission || !ref.current || !material.current) return;
    if (activeId.current !== emission.id) {
      activeId.current = emission.id;
      elapsed.current = 0;
      ref.current.scale.setScalar(0.2);
      material.current.opacity = 0.42;
    }
    const duration = reducedMotion ? 0.55 : 1.35;
    elapsed.current += dt;
    const progress = Math.min(1, elapsed.current / duration);
    const visualRange = emission.range * (reducedMotion ? 0.35 : 1);
    ref.current.scale.setScalar(0.2 + visualRange * progress);
    material.current.opacity = 0.42 * (1 - progress);
    if (progress >= 1) {
      useSimulationStore.getState().clearSonarEmission(emission.id);
    }
  });

  if (!emission) return null;

  return (
    <mesh
      key={emission.id}
      ref={ref}
      position={emission.position}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.96, 1, 64]} />
      <meshBasicMaterial
        ref={material}
        color="#59f1d4"
        transparent
        opacity={0.45}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function SceneController() {
  const cameraMode = useSimulationStore((s) => s.preferences.camera);
  const { camera } = useThree();
  const sceneRevision = useSimulationStore((s) => s.sceneRevision);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  // Snap once after a level change so camera damping cannot travel across the
  // previous mission's world before settling behind the new starting point.
  useEffect(() => {
    const current = useSimulationStore.getState();
    const offset = followCameraOffset(current.heading);
    camera.position.set(
      current.position[0] + offset[0],
      current.position[1] + offset[1],
      current.position[2] + offset[2],
    );
  }, [camera, sceneRevision]);

  // Advance the simulation before moving the camera smoothly. Orbit mode
  // delegates camera input to `OrbitControls` instead.
  useFrame((_, dt) => {
    useSimulationStore.getState().tick(dt);
    if (cameraMode === "orbit") return;

    const { position, heading } = useSimulationStore.getState();

    const offset =
      cameraMode === "cockpit"
        ? cockpitCameraOffset(heading)
        : followCameraOffset(heading);
    const forward = headingToForward(heading);

    desired.set(
      position[0] + offset[0],
      position[1] + offset[1],
      position[2] + offset[2],
    );
    camera.position.lerp(
      desired,
      1 - Math.exp(-(cameraMode === "cockpit" ? 18 : 7) * Math.min(dt, 0.05)),
    );
    lookTarget.set(
      position[0] + forward[0] * 10,
      position[1] + forward[1] * 10,
      position[2] + forward[2] * 10,
    );
    camera.lookAt(lookTarget);
  });

  return cameraMode === "orbit" ? (
    <OrbitCamera sceneRevision={sceneRevision} />
  ) : null;
}

function OrbitCamera({ sceneRevision }) {
  const controls = useRef();
  const [desiredTarget] = useState(() => new THREE.Vector3());

  useEffect(() => {
    const position = useSimulationStore.getState().position;
    desiredTarget.set(...position);
    if (controls.current) controls.current.target.copy(desiredTarget);
  }, [desiredTarget, sceneRevision]);

  useFrame((_, dt) => {
    if (!controls.current) {
      return;
    }

    desiredTarget.set(...useSimulationStore.getState().position);
    controls.current.target.lerp(
      desiredTarget,
      1 - Math.exp(-10 * Math.min(dt, 0.05)),
    );
    controls.current.update();
  });

  return (
    <OrbitControls
      ref={controls}
      target={desiredTarget}
      enablePan={false}
      minDistance={6}
      maxDistance={35}
      maxPolarAngle={Math.PI * 0.85}
    />
  );
}

function World() {
  const quality = useSimulationStore((s) => s.preferences.quality);
  const level = useSimulationStore(selectCurrentLevel);
  const discovered = useSimulationStore((s) => s.discoveredObjects);
  const identified = useSimulationStore((s) => s.identifiedObjects);

  // Quality profiles control visibility, particle density, shadows, and DPR.
  return (
    <>
      <fog
        attach="fog"
        args={[
          level.world.waterColor,
          level.world.fogNear,
          quality === "low" ? level.world.fogFar * 0.78 : level.world.fogFar,
        ]}
      />
      <ambientLight intensity={0.32} color={level.world.ambient} />
      <hemisphereLight color="#174a53" groundColor="#010407" intensity={0.7} />
      <Terrain level={level} />
      {level.rocks.map((rock) => (
        <Rock key={rock.id} position={rock.position} scale={rock.scale} />
      ))}
      {level.objects.map((object) => (
        <Beacon
          object={object}
          revealed={!object.hidden || discovered.includes(object.id)}
          identified={!object.hidden || identified.includes(object.id)}
          key={object.id}
        />
      ))}
      <MarineSnow count={QUALITY[quality].particles} />
      <Submersible />
      <SonarPulse />
      <SceneController />
    </>
  );
}

export default function UnderwaterScene() {
  const quality = useSimulationStore((s) => s.preferences.quality);
  const level = useSimulationStore(selectCurrentLevel);
  return (
    <Canvas
      className="ocean-canvas"
      shadows={QUALITY[quality].shadows}
      dpr={[1, QUALITY[quality].dpr]}
      camera={{
        position: [0, 34, 28],
        fov: 58,
        near: 0.1,
        far: Math.max(700, level.world.terrainSize * 1.4),
      }}
      gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
    >
      <color attach="background" args={[level.world.waterColor]} />
      <Suspense fallback={null}>
        <World />
      </Suspense>
    </Canvas>
  );
}
