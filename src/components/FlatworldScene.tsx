import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, Text, useTexture } from "@react-three/drei";
import * as THREE from "three";
import besleyFont from "@fontsource/besley/files/besley-latin-700-normal.woff?url";
import type { InterventionTool } from "../experience";
import { DimensionalState, type CameraMode, type CameraPoseSave, type ExperienceMode, type QualityPreference, type RenderSnapshot, type ResidentStatic, type Surface, type Vec2, type Venue, type Wall, type WorldStatic } from "../types";
import { wallCollision } from "../simulation/geometry";
import { resolveBoundaryEditCandidate, type BoundaryEditAction, type BoundaryEditCandidate } from "./boundaryEditing";
import { groundInteractionIntent } from "./groundInteraction";
import {
  clampSurveyTarget,
  SURVEY_CAMERA_POSITION,
  SURVEY_MAX_DISTANCE,
  SURVEY_MAX_POLAR_DEGREES,
  SURVEY_MIN_DISTANCE,
  SURVEY_MIN_POLAR_DEGREES
} from "./cameraNavigation";
import {
  RESIDENT_FILL_CENTER_Y,
  RESIDENT_FILL_HEIGHT,
  RESIDENT_OUTLINE_CENTER_Y,
  RESIDENT_OUTLINE_HEIGHT,
  surfaceSlab
} from "./sceneDepth";

export type SceneExperience = {
  mode: ExperienceMode;
  cameraMode: CameraMode;
  projection: "perspective" | "orthographic";
  selectedResidentId: number | null;
  followedResidentId: number | null;
  controlledResidentId: number | null;
  carriedResidentId: number | null;
  fallingResidentId: number | null;
  introActive: boolean;
  interventionTool: InterventionTool;
};

export type CameraInput = { forward: number; right: number; altitude: number; fast: boolean };

type SceneProps = {
  world: WorldStatic;
  residents: ResidentStatic[];
  snapshot?: RenderSnapshot;
  experience: SceneExperience;
  cameraInput: CameraInput;
  quality: QualityPreference;
  frameSignal: number;
  resetSignal: number;
  restorePose?: CameraPoseSave;
  restorePoseSignal: number;
  previewTarget?: Vec2;
  onSelect: (id: number) => void;
  onWorldPoint: (point: Vec2) => void;
  onBoundaryEdit: (action: BoundaryEditAction, point: Vec2) => void;
  onCameraInteraction: () => void;
  onCameraPose: (pose: CameraPoseSave) => void;
  activationVerb?: "Click" | "Tap";
};

const SIDES = [3, 4, 5, 6, 8, 12] as const;

function CameraSet({ projection }: { projection: SceneExperience["projection"] }) {
  const { camera, set, size } = useThree();
  const perspective = useRef<THREE.PerspectiveCamera>(null);
  const orthographic = useRef<THREE.OrthographicCamera>(null);
  const initialized = useRef(false);

  useLayoutEffect(() => {
    const next = projection === "orthographic" ? orthographic.current : perspective.current;
    if (!next) return;
    if (!initialized.current) {
      initialized.current = true;
    } else if (next !== camera) {
      next.position.copy(camera.position);
      next.quaternion.copy(camera.quaternion);
    }
    if (next instanceof THREE.OrthographicCamera) {
      next.left = -size.width / 2;
      next.right = size.width / 2;
      next.top = size.height / 2;
      next.bottom = -size.height / 2;
      next.zoom = Math.min(size.width / 150, size.height / 116);
    }
    next.updateProjectionMatrix();
    if (next !== camera) set({ camera: next });
  }, [camera, projection, set, size]);

  return (
    <>
      <perspectiveCamera ref={perspective} fov={48} near={0.3} far={280} position={[SURVEY_CAMERA_POSITION.x, SURVEY_CAMERA_POSITION.y, SURVEY_CAMERA_POSITION.z]} />
      <orthographicCamera ref={orthographic} near={0.3} far={280} position={[0, 112, 18]} />
    </>
  );
}

function residentPose(snapshot: RenderSnapshot | undefined, residentId: number | null) {
  if (!snapshot || residentId === null || residentId >= snapshot.residentCount) return undefined;
  const offset = residentId * snapshot.stride;
  return {
    x: snapshot.data[offset],
    z: snapshot.data[offset + 1],
    rotation: snapshot.data[offset + 2]
  };
}

type SnapshotHistory = { previous?: RenderSnapshot; current?: RenderSnapshot; receivedAt: number };

function interpolatedPose(history: SnapshotHistory, residentId: number | null, now = performance.now()) {
  const current = history.current;
  if (!current || residentId === null || residentId >= current.residentCount) return undefined;
  const previous = history.previous && residentId < history.previous.residentCount ? history.previous : current;
  const currentOffset = residentId * current.stride;
  const previousOffset = residentId * previous.stride;
  const alpha = THREE.MathUtils.clamp((now - history.receivedAt) / (1000 / 15), 0, 1);
  let rotationDelta = current.data[currentOffset + 2] - previous.data[previousOffset + 2];
  while (rotationDelta > Math.PI) rotationDelta -= Math.PI * 2;
  while (rotationDelta < -Math.PI) rotationDelta += Math.PI * 2;
  const lateSeconds = THREE.MathUtils.clamp((now - history.receivedAt - 1000 / 15) / 1000, 0, 0.1);
  return {
    x: THREE.MathUtils.lerp(previous.data[previousOffset], current.data[currentOffset], alpha) + (current.data[currentOffset + 8] ?? 0) * lateSeconds,
    z: THREE.MathUtils.lerp(previous.data[previousOffset + 1], current.data[currentOffset + 1], alpha) + (current.data[currentOffset + 9] ?? 0) * lateSeconds,
    rotation: previous.data[previousOffset + 2] + rotationDelta * alpha,
    altitude: THREE.MathUtils.lerp(previous.data[previousOffset + 3], current.data[currentOffset + 3], alpha)
  };
}

function CameraController({ snapshot, experience, cameraInput, frameSignal, resetSignal, restorePose, restorePoseSignal, controls, manualLookUntil, onCameraPose }: Pick<SceneProps, "snapshot" | "experience" | "cameraInput" | "frameSignal" | "resetSignal" | "restorePose" | "restorePoseSignal" | "onCameraPose"> & { controls: React.RefObject<any>; manualLookUntil: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const lastFrameSignal = useRef(frameSignal);
  const lastResetSignal = useRef(resetSignal);
  const lastMode = useRef<string>("");
  const lastRestorePoseSignal = useRef(restorePoseSignal);
  const lastTarget = useRef<THREE.Vector3 | undefined>(undefined);
  const lastCarriedId = useRef<number | null>(experience.carriedResidentId);
  const poseFrame = useRef(0);
  const history = useRef<SnapshotHistory>({ receivedAt: performance.now() });
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (!snapshot) return;
    history.current = { previous: history.current.current ?? snapshot, current: snapshot, receivedAt: performance.now() };
  }, [snapshot]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useFrame((_, dt) => {
    const orbit = controls.current;
    const blend = (rate: number) => reducedMotion ? 1 : 1 - Math.exp(-dt * rate);
    const modeKey = `${experience.cameraMode}-${experience.followedResidentId}-${experience.controlledResidentId}-${experience.carriedResidentId}`;
    const trackedId = experience.carriedResidentId !== null
      ? experience.carriedResidentId
      : ["chase", "overhead", "native"].includes(experience.cameraMode)
      ? experience.controlledResidentId
      : experience.cameraMode === "follow"
        ? experience.followedResidentId
        : null;
    const tracked = interpolatedPose(history.current, trackedId);

    if (lastRestorePoseSignal.current !== restorePoseSignal && restorePose) {
      camera.position.set(...restorePose.position);
      orbit?.target.set(...restorePose.target);
      orbit?.update();
      lastRestorePoseSignal.current = restorePoseSignal;
      lastMode.current = modeKey;
    }

    const modeChanged = lastMode.current !== modeKey;
    const returningFromCarry = lastCarriedId.current !== null
      && experience.carriedResidentId === null
      && trackedId === lastCarriedId.current;
    lastCarriedId.current = experience.carriedResidentId;
    if (modeChanged) {
      lastMode.current = modeKey;
      lastTarget.current = undefined;
      if (tracked) {
        const target = new THREE.Vector3(tracked.x, experience.carriedResidentId === null ? 0.18 : Math.max(0.18, tracked.altitude), tracked.z);
        const forward = new THREE.Vector3(Math.sin(tracked.rotation), 0, Math.cos(tracked.rotation));
        if (!returningFromCarry) {
          if (experience.introActive) camera.position.set(tracked.x + 9.5, 6.2, tracked.z - 9);
          else if (experience.carriedResidentId !== null) camera.position.set(tracked.x + 9, tracked.altitude + 8, tracked.z + 12);
          else if (experience.cameraMode === "overhead") camera.position.set(tracked.x, 30, tracked.z + 8);
          else camera.position.copy(target).addScaledVector(forward, experience.cameraMode === "chase" ? -8.5 : -11.5).add(new THREE.Vector3(2.2, experience.cameraMode === "chase" ? 5.2 : 7.2, 0));
          orbit?.target.copy(target);
          camera.lookAt(target);
          orbit?.update();
        }
        lastTarget.current = target;
      } else if (experience.cameraMode === "survey") {
        const target = new THREE.Vector3(0, 0, 0);
        camera.position.set(SURVEY_CAMERA_POSITION.x, SURVEY_CAMERA_POSITION.y, SURVEY_CAMERA_POSITION.z);
        orbit?.target.copy(target);
        camera.lookAt(target);
        orbit?.update();
      }
    }

    if (lastResetSignal.current !== resetSignal) {
      lastResetSignal.current = resetSignal;
      if (tracked) {
        const target = new THREE.Vector3(tracked.x, 0.18, tracked.z);
        const forward = new THREE.Vector3(Math.sin(tracked.rotation), 0, Math.cos(tracked.rotation));
        camera.position.copy(target).addScaledVector(forward, -8.5).add(new THREE.Vector3(0, 5.2, 0));
        orbit?.target.copy(target);
      } else {
        camera.position.set(SURVEY_CAMERA_POSITION.x, SURVEY_CAMERA_POSITION.y, SURVEY_CAMERA_POSITION.z);
        orbit?.target.set(0, 0, 0);
      }
      orbit?.update();
    }

    if (lastFrameSignal.current !== frameSignal || experience.cameraMode === "framed") {
      camera.position.lerp(new THREE.Vector3(0, 112, 18), blend(3.2));
      orbit?.target.lerp(new THREE.Vector3(0, 0, 0), blend(4));
      orbit?.update();
      lastFrameSignal.current = frameSignal;
    } else if (tracked && experience.carriedResidentId !== null) {
      const target = new THREE.Vector3(tracked.x, Math.max(0.18, tracked.altitude), tracked.z);
      if (lastTarget.current) {
        const carryDelta = target.clone().sub(lastTarget.current);
        if (experience.fallingResidentId === trackedId) carryDelta.y = 0;
        camera.position.add(carryDelta);
      }
      orbit?.target.lerp(target, blend(experience.fallingResidentId === trackedId ? 2.4 : 9));
      orbit?.update();
      lastTarget.current = target;
    } else if (tracked && experience.cameraMode === "chase") {
      const target = new THREE.Vector3(tracked.x, 0.18, tracked.z);
      const forward = new THREE.Vector3(Math.sin(tracked.rotation), 0, Math.cos(tracked.rotation));
      const lookAhead = target.clone().addScaledVector(forward, 2.1);
      if (performance.now() >= manualLookUntil.current) {
        const desiredPosition = target.clone().addScaledVector(forward, -8.5).add(new THREE.Vector3(0, 5.2, 0));
        camera.position.lerp(desiredPosition, blend(5.8));
        orbit?.target.lerp(lookAhead, blend(7.5));
      } else if (lastTarget.current) camera.position.add(target.clone().sub(lastTarget.current));
      orbit?.update();
      lastTarget.current = target;
    } else if (tracked && experience.cameraMode === "overhead") {
      const target = new THREE.Vector3(tracked.x, 0.18, tracked.z);
      camera.position.lerp(new THREE.Vector3(tracked.x, 30, tracked.z + 8), blend(6));
      orbit?.target.lerp(target, blend(8));
      orbit?.update();
      lastTarget.current = target;
    } else if (tracked && experience.cameraMode === "follow") {
      const target = new THREE.Vector3(tracked.x, 0.18, tracked.z);
      if (lastTarget.current) camera.position.add(target.clone().sub(lastTarget.current));
      orbit?.target.lerp(target, blend(8));
      orbit?.update();
      lastTarget.current = target;
    } else if (experience.cameraMode === "survey" && (experience.mode === "explore" || experience.mode === "intervene")) {
      const forward = orbit ? orbit.target.clone().sub(camera.position).setY(0) : new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
      if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
      forward.normalize();
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const speed = (cameraInput.fast ? 34 : 15) * dt * Math.max(0.65, camera.position.y / 32);
      const delta = forward.multiplyScalar(cameraInput.forward * speed).add(right.multiplyScalar(cameraInput.right * speed));
      if (delta.lengthSq() || cameraInput.altitude) {
        camera.position.add(delta);
        camera.position.y = THREE.MathUtils.clamp(camera.position.y + cameraInput.altitude * speed, 6, 125);
        orbit?.target.add(delta);
        if (orbit) {
          orbit.update();
        }
      }
    }

    poseFrame.current += 1;
    if (poseFrame.current % 30 === 0) {
      const target = orbit?.target ?? new THREE.Vector3(0, 0, 0);
      onCameraPose({ position: [camera.position.x, camera.position.y, camera.position.z], target: [target.x, target.y, target.z], projection: experience.projection });
    }
  });
  return null;
}

function SurfaceMesh({ surface, layer }: { surface: Surface; layer: number }) {
  const [sourceMap, sourceNormal] = useTexture([
    `/assets/materials/${surface.materialId}.png`,
    `/assets/materials/${surface.materialId}-normal.png`
  ]);
  const maps = useMemo(() => {
    const map = sourceMap.clone();
    const normal = sourceNormal.clone();
    for (const texture of [map, normal]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(Math.max(1, surface.size.x / 14), Math.max(1, surface.size.z / 14));
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    }
    map.colorSpace = THREE.SRGBColorSpace;
    return { map, normal };
  }, [sourceMap, sourceNormal, surface.size.x, surface.size.z]);
  useEffect(() => () => {
    maps.map.dispose();
    maps.normal.dispose();
  }, [maps]);
  const slab = surfaceSlab(surface.kind, layer);
  const roughness = surface.kind === "road" ? 0.95 : 0.84;
  return (
    <mesh position={[surface.center.x, slab.centerY, surface.center.z]} receiveShadow>
      <boxGeometry args={[surface.size.x, slab.height, surface.size.z]} />
      <meshStandardMaterial
        map={maps.map}
        normalMap={maps.normal}
        normalScale={new THREE.Vector2(0.18, 0.18)}
        color="#ffffff"
        roughness={roughness}
        metalness={0}
      />
      {surface.kind !== "plane" && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(surface.size.x, slab.height + 0.001, surface.size.z)]} />
          <lineBasicMaterial color={surface.kind === "road" ? "#302b25" : "#594d38"} transparent opacity={surface.kind === "road" ? 0.42 : 0.55} />
        </lineSegments>
      )}
    </mesh>
  );
}

function Boundary({ wall }: { wall: Wall }) {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const length = Math.hypot(dx, dz);
  return (
    <mesh position={[(wall.a.x + wall.b.x) / 2, 0.075, (wall.a.z + wall.b.z) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
      <boxGeometry args={[length, 0.08, wall.heritage ? 0.22 : 0.18]} />
      <meshStandardMaterial color="#302b25" roughness={0.82} metalness={0} />
    </mesh>
  );
}

function AltitudeLayer({ min, max, children }: { min: number; max: number; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const wasVisible = useRef(true);
  useFrame(({ camera }) => {
    const visible = camera.position.y >= min && camera.position.y <= max;
    if (visible === wasVisible.current) return;
    wasVisible.current = visible;
    if (group.current) group.current.visible = visible;
  });
  return <group ref={group}>{children}</group>;
}

function mapLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function StreetLabels({ surfaces }: { surfaces: Surface[] }) {
  const labels = useMemo(() => surfaces.filter((surface) => surface.kind === "road").map((surface) => {
    const horizontal = surface.size.x >= surface.size.z;
    const span = horizontal ? surface.size.x : surface.size.z;
    const offset = horizontal ? -Math.min(40, span * 0.32) : Math.min(24, span * 0.28);
    return {
      id: surface.id,
      label: mapLabel(surface.id).toUpperCase(),
      x: surface.center.x + (horizontal ? offset : 0),
      z: surface.center.z + (horizontal ? 0 : offset),
      rotationY: horizontal ? 0 : -Math.PI / 2,
      maxWidth: Math.min(32, span * 0.42)
    };
  }), [surfaces]);

  return (
    <AltitudeLayer min={26} max={132}>
      {labels.map((label) => (
        <group key={label.id} position={[label.x, 0.074, label.z]} rotation={[0, label.rotationY, 0]}>
          <Text
            font={besleyFont}
            fontSize={0.92}
            letterSpacing={0.13}
            color="#e1d2ae"
            outlineWidth={0.018}
            outlineColor="#302b25"
            anchorX="center"
            anchorY="middle"
            rotation={[-Math.PI / 2, 0, 0]}
            maxWidth={label.maxWidth}
            textAlign="center"
            renderOrder={12}
            material-depthTest={false}
            material-depthWrite={false}
          >
            {label.label}
          </Text>
        </group>
      ))}
    </AltitudeLayer>
  );
}

function PlaceLabels({ world }: { world: WorldStatic }) {
  return (
    <AltitudeLayer min={18} max={132}>
      {world.publicPlaces.map((place) => (
        <Text
          key={place.id}
          font={besleyFont}
          fontSize={0.86}
          letterSpacing={0.08}
          color="#302b25"
          outlineWidth={0.014}
          outlineColor="#d6c39b"
          anchorX="center"
          anchorY="middle"
          position={[place.center.x, 0.084, place.center.z - place.size.z / 2 + 1.15]}
          rotation={[-Math.PI / 2, 0, 0]}
          maxWidth={Math.max(8, place.size.x - 2)}
          textAlign="center"
          renderOrder={12}
          material-depthTest={false}
          material-depthWrite={false}
        >
          {place.name.toUpperCase()}
        </Text>
      ))}
    </AltitudeLayer>
  );
}

function TargetPreviewMarker({ point }: { point: Vec2 }) {
  const marker = useRef<THREE.Group>(null);
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useFrame(({ clock }) => {
    if (!marker.current) return;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 4.5) * 0.12;
    marker.current.scale.setScalar(pulse);
    marker.current.rotation.y = reducedMotion ? 0 : clock.elapsedTime * 0.35;
  });
  return (
    <group ref={marker} position={[point.x, 0.16, point.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.55, 36]} />
        <meshBasicMaterial color="#fff4c8" transparent opacity={0.96} toneMapped={false} depthTest={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.78, 1.9, 36]} />
        <meshBasicMaterial color="#3f716b" transparent opacity={0.9} toneMapped={false} depthTest={false} />
      </mesh>
    </group>
  );
}

function PortalTicks({ world }: { world: WorldStatic }) {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    for (const portal of world.portals) {
      const dx = portal.b.x - portal.a.x;
      const dz = portal.b.z - portal.a.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.001) continue;
      const normalX = -dz / length;
      const normalZ = dx / length;
      const halfTick = 0.42;
      for (const point of [portal.a, portal.b]) {
        vertices.push(
          point.x - normalX * halfTick, 0.118, point.z - normalZ * halfTick,
          point.x + normalX * halfTick, 0.118, point.z + normalZ * halfTick
        );
      }
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return result;
  }, [world.portals]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <AltitudeLayer min={11} max={132}>
      <lineSegments geometry={geometry} renderOrder={8}>
        <lineBasicMaterial color="#d7af60" transparent opacity={0.82} depthTest={false} toneMapped={false} />
      </lineSegments>
    </AltitudeLayer>
  );
}

type DestinationMark = {
  key: string;
  point: Vec2;
  radius: number;
};

function destinationMark(world: WorldStatic, snapshot: RenderSnapshot | undefined, residentId: number | null): DestinationMark | undefined {
  if (!snapshot || residentId === null) return undefined;
  const telemetry = snapshot.telemetry.find((resident) => resident.residentId === residentId);
  if (!telemetry) return undefined;

  const destinationId = telemetry.destinationBuildingId ?? telemetry.waitingVenueId;
  const normalizedName = telemetry.destinationName.trim().toLocaleLowerCase();
  const building = world.buildings.find((candidate) => candidate.id === destinationId)
    ?? world.buildings.find((candidate) => candidate.name.toLocaleLowerCase() === normalizedName || candidate.shortName.toLocaleLowerCase() === normalizedName);
  if (building) {
    return {
      key: `building-${building.id}`,
      point: building.center,
      radius: THREE.MathUtils.clamp(Math.min(building.size.x, building.size.z) * 0.2, 1.65, 2.55)
    };
  }

  const place = world.publicPlaces.find((candidate) => candidate.name.toLocaleLowerCase() === normalizedName);
  if (!place) return undefined;
  return {
    key: `place-${place.id}`,
    point: place.center,
    radius: THREE.MathUtils.clamp(Math.min(place.size.x, place.size.z) * 0.24, 1.65, 2.7)
  };
}

function DestinationPulse({ world, snapshot, selectedId }: { world: WorldStatic; snapshot?: RenderSnapshot; selectedId: number | null }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const destination = useMemo(() => destinationMark(world, snapshot, selectedId), [selectedId, snapshot, world]);

  useFrame(({ camera, clock }) => {
    if (!group.current || !ring.current) return;
    const visible = Boolean(destination) && camera.position.y >= 11 && camera.position.y <= 132;
    group.current.visible = visible;
    if (!visible) return;
    const wave = reducedMotion ? 0.45 : (Math.sin(clock.elapsedTime * 2.25) + 1) / 2;
    group.current.scale.setScalar(1 + wave * 0.13);
    ring.current.opacity = 0.58 - wave * 0.22;
  });

  if (!destination) return null;
  return (
    <group ref={group} key={destination.key} position={[destination.point.x, 0.126, destination.point.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
        <ringGeometry args={[destination.radius, destination.radius + 0.11, 48]} />
        <meshBasicMaterial ref={ring} color="#c08b35" transparent opacity={0.5} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rotation) => (
        <mesh key={rotation} position={[Math.cos(rotation) * (destination.radius + 0.42), 0, Math.sin(rotation) * (destination.radius + 0.42)]} rotation={[0, -rotation, 0]}>
          <boxGeometry args={[0.52, 0.022, 0.055]} />
          <meshBasicMaterial color="#9a6728" transparent opacity={0.72} depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Residents({ residents, snapshot, selectedId, onSelect, interactive = true }: { residents: ResidentStatic[]; snapshot?: RenderSnapshot; selectedId: number | null; onSelect: (id: number) => void; interactive?: boolean }) {
  const fillRefs = useRef<Record<number, THREE.InstancedMesh | null>>({});
  const outlineRefs = useRef<Record<number, THREE.InstancedMesh | null>>({});
  const hitRefs = useRef<Record<number, THREE.InstancedMesh | null>>({});
  const selection = useRef<THREE.Mesh>(null);
  const hoverHalo = useRef<THREE.Mesh>(null);
  const hoverLabel = useRef<THREE.Group>(null);
  const landingRing = useRef<THREE.Mesh>(null);
  const landingRingMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const landingCue = useRef<{ residentId: number; startedAt: number } | undefined>(undefined);
  const airborneGroundCue = useRef<THREE.Group>(null);
  const airborneShadowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const labelledId = hoveredId ?? selectedId;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const groups = useMemo(() => SIDES.map((sides) => ({ sides, members: residents.filter((resident) => resident.sides === sides) })), [residents]);
  const history = useRef<SnapshotHistory>({ receivedAt: performance.now() });

  useEffect(() => {
    if (!snapshot) return;
    const previous = history.current.current;
    if (previous) {
      const count = Math.min(previous.residentCount, snapshot.residentCount);
      for (let residentId = 0; residentId < count; residentId += 1) {
        const previousState = previous.data[residentId * previous.stride + 4];
        const currentState = snapshot.data[residentId * snapshot.stride + 4];
        if (previousState === DimensionalState.BeingReinserted && currentState === DimensionalState.OnPlane) {
          landingCue.current = { residentId, startedAt: performance.now() };
          break;
        }
      }
    }
    history.current = { previous: history.current.current ?? snapshot, current: snapshot, receivedAt: performance.now() };
  }, [snapshot]);

  useEffect(() => {
    groups.forEach(({ sides, members }) => {
      const mesh = fillRefs.current[sides];
      if (!mesh) return;
      members.forEach((resident, instanceId) => mesh.setColorAt(instanceId, new THREE.Color(resident.color)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [groups]);

  useFrame(({ camera }) => {
    if (!snapshot) return;
    groups.forEach(({ sides, members }) => {
      const fill = fillRefs.current[sides];
      const outline = outlineRefs.current[sides];
      const hit = hitRefs.current[sides];
      if (!fill || !outline || !hit) return;
      members.forEach((resident, instanceId) => {
        const pose = interpolatedPose(history.current, resident.id);
        if (!pose) return;
        dummy.position.set(pose.x, RESIDENT_FILL_CENTER_Y + pose.altitude, pose.z);
        dummy.rotation.set(0, pose.rotation, 0);
        dummy.scale.setScalar(resident.radius);
        dummy.updateMatrix();
        fill.setMatrixAt(instanceId, dummy.matrix);
        dummy.position.y = RESIDENT_OUTLINE_CENTER_Y + pose.altitude;
        dummy.scale.setScalar(resident.radius * 1.09);
        dummy.updateMatrix();
        outline.setMatrixAt(instanceId, dummy.matrix);
        dummy.position.y = 0.34 + pose.altitude;
        const hitRadius = Math.max(1.75, resident.radius * 1.85);
        dummy.scale.set(hitRadius, 1, hitRadius);
        dummy.updateMatrix();
        hit.setMatrixAt(instanceId, dummy.matrix);
      });
      fill.instanceMatrix.needsUpdate = true;
      outline.instanceMatrix.needsUpdate = true;
      hit.instanceMatrix.needsUpdate = true;
    });
    if (selection.current) {
      if (selectedId === null || selectedId >= snapshot.residentCount) selection.current.visible = false;
      else {
        const resident = residents[selectedId];
        const pose = interpolatedPose(history.current, selectedId);
        if (!pose) return;
        selection.current.visible = true;
        selection.current.position.set(pose.x, 0.095 + pose.altitude, pose.z);
        selection.current.scale.setScalar(resident.radius * 1.27);
      }
    }
    if (airborneGroundCue.current && airborneShadowMaterial.current) {
      const selectedState = selectedId === null ? DimensionalState.OnPlane : snapshot.data[selectedId * snapshot.stride + 4];
      const pose = interpolatedPose(history.current, selectedId);
      const airborne = selectedState === DimensionalState.OffPlane || selectedState === DimensionalState.BeingReinserted;
      airborneGroundCue.current.visible = airborne && Boolean(pose);
      if (airborne && pose && selectedId !== null) {
        const resident = residents[selectedId];
        airborneGroundCue.current.position.set(pose.x, 0.102, pose.z);
        airborneGroundCue.current.scale.setScalar(resident.radius * (1.05 + Math.min(10, pose.altitude) * 0.025));
        airborneShadowMaterial.current.opacity = THREE.MathUtils.clamp(0.34 - pose.altitude * 0.02, 0.1, 0.31);
      }
    }
    if (hoverLabel.current) {
      const pose = interpolatedPose(history.current, labelledId);
      hoverLabel.current.visible = Boolean(pose);
      if (pose) {
        hoverLabel.current.position.set(pose.x, 0.28 + pose.altitude, pose.z);
        const distanceScale = camera instanceof THREE.OrthographicCamera
          ? 2.6
          : THREE.MathUtils.clamp(camera.position.distanceTo(hoverLabel.current.position) / 12, 0.75, 3.2);
        hoverLabel.current.scale.setScalar(distanceScale);
      }
    }
    if (hoverHalo.current) {
      const pose = interpolatedPose(history.current, hoveredId);
      hoverHalo.current.visible = Boolean(pose) && hoveredId !== selectedId;
      if (pose && hoveredId !== null) {
        hoverHalo.current.position.set(pose.x, 0.092 + pose.altitude, pose.z);
        hoverHalo.current.scale.setScalar(residents[hoveredId].radius * 1.3);
      }
    }
    if (landingRing.current && landingRingMaterial.current) {
      const cue = landingCue.current;
      const elapsed = cue ? (performance.now() - cue.startedAt) / 620 : 1;
      const pose = cue ? interpolatedPose(history.current, cue.residentId) : undefined;
      if (!cue || !pose || elapsed >= 1) {
        landingRing.current.visible = false;
        if (elapsed >= 1) landingCue.current = undefined;
      } else {
        const radius = residents[cue.residentId]?.radius ?? 1;
        landingRing.current.visible = true;
        landingRing.current.position.set(pose.x, 0.105, pose.z);
        landingRing.current.scale.setScalar(radius * (1.15 + elapsed * 1.35));
        landingRingMaterial.current.opacity = 0.72 * (1 - elapsed);
      }
    }
  });

  return (
    <group>
      {groups.map(({ sides, members }) => (
        <group key={sides}>
          <instancedMesh ref={(mesh) => { outlineRefs.current[sides] = mesh; }} args={[undefined, undefined, members.length]} frustumCulled={false}>
            <cylinderGeometry args={[1, 1, RESIDENT_OUTLINE_HEIGHT, sides]} />
            <meshBasicMaterial color="#302b25" />
          </instancedMesh>
          <instancedMesh
            ref={(mesh) => { fillRefs.current[sides] = mesh; }}
            args={[undefined, undefined, members.length]}
            frustumCulled={false}
            onClick={interactive ? (event) => {
              event.stopPropagation();
              const resident = event.instanceId === undefined ? undefined : members[event.instanceId];
              if (resident) onSelect(resident.id);
            } : undefined}
          >
            <cylinderGeometry args={[1, 1, RESIDENT_FILL_HEIGHT, sides]} />
            <meshStandardMaterial color="#ffffff" roughness={0.65} metalness={0} />
          </instancedMesh>
          <instancedMesh
            ref={(mesh) => { hitRefs.current[sides] = mesh; }}
            args={[undefined, undefined, members.length]}
            frustumCulled={false}
            onClick={interactive ? (event) => {
              event.stopPropagation();
              const resident = event.instanceId === undefined ? undefined : members[event.instanceId];
              if (resident) onSelect(resident.id);
            } : undefined}
            onPointerOver={interactive ? (event) => {
              event.stopPropagation();
              const resident = event.instanceId === undefined ? undefined : members[event.instanceId];
              setHoveredId(resident?.id ?? null);
              document.body.style.cursor = resident ? "pointer" : "default";
            } : undefined}
            onPointerOut={interactive ? () => {
              setHoveredId(null);
              document.body.style.cursor = "default";
            } : undefined}
          >
            <cylinderGeometry args={[1, 1, 0.65, Math.max(8, sides)]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </instancedMesh>
        </group>
      ))}
      <mesh ref={selection} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.035, 8, 40]} />
        <meshBasicMaterial color="#e3c269" toneMapped={false} depthTest={false} />
      </mesh>
      <mesh ref={hoverHalo} visible={false} rotation={[Math.PI / 2, 0, 0]} renderOrder={20}>
        <torusGeometry args={[1, 0.025, 8, 40]} />
        <meshBasicMaterial color="#3f716b" transparent opacity={0.72} toneMapped={false} depthTest={false} />
      </mesh>
      <mesh ref={landingRing} visible={false} rotation={[Math.PI / 2, 0, 0]} renderOrder={21}>
        <torusGeometry args={[1, 0.045, 8, 48]} />
        <meshBasicMaterial ref={landingRingMaterial} color="#f0cb6e" transparent opacity={0} toneMapped={false} depthTest={false} depthWrite={false} />
      </mesh>
      <group ref={airborneGroundCue} visible={false} renderOrder={19}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial ref={airborneShadowMaterial} color="#302b25" transparent opacity={0.18} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.16, 0.035, 8, 40]} />
          <meshBasicMaterial color="#e3c269" transparent opacity={0.72} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <group ref={hoverLabel} visible={false}>
        <Billboard follow>
          <Text
            font={besleyFont}
            fontSize={0.32}
            color="#302b25"
            outlineWidth={0.014}
            outlineColor="#efe2c3"
            anchorX="center"
            anchorY="bottom"
            position={[-0.65, 0.82, 0]}
            renderOrder={30}
            frustumCulled={false}
            material-depthTest={false}
            material-depthWrite={false}
          >
            {labelledId === null ? "" : residents[labelledId]?.name ?? ""}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

function BuildingLabels({ buildings }: { buildings: Venue[] }) {
  return (
    <AltitudeLayer min={12} max={132}>
      {buildings.filter((building) => building.kind !== "home").map((building) => (
        <Text
          key={building.id}
          font={besleyFont}
          fontSize={1.35}
          color="#302b25"
          anchorX="center"
          anchorY="middle"
          position={[building.center.x, 0.07, building.center.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          maxWidth={building.size.x - 1}
          textAlign="center"
          renderOrder={12}
          material-depthTest={false}
          material-depthWrite={false}
        >
          {building.shortName.toUpperCase()}
        </Text>
      ))}
    </AltitudeLayer>
  );
}

function BoundaryEditHighlight({
  candidate,
  onApply,
  onActionEngagementChange
}: {
  candidate: BoundaryEditCandidate;
  onApply: () => void;
  onActionEngagementChange: (engaged: boolean) => void;
}) {
  const dx = candidate.b.x - candidate.a.x;
  const dz = candidate.b.z - candidate.a.z;
  const length = Math.hypot(dx, dz);
  const remove = candidate.action === "cut";
  return (
    <group>
      <mesh
        position={[(candidate.a.x + candidate.b.x) / 2, 0.2, (candidate.a.z + candidate.b.z) / 2]}
        rotation={[0, -Math.atan2(dz, dx), 0]}
        renderOrder={40}
      >
        <boxGeometry args={[length, 0.12, 0.66]} />
        <meshBasicMaterial
          color={remove ? "#b94f46" : "#2e8067"}
          transparent
          opacity={0.9}
          toneMapped={false}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <Html
        center
        position={[candidate.point.x, 0.75, candidate.point.z]}
        zIndexRange={[11, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="boundary-toggle-hit-area"
          onPointerEnter={() => onActionEngagementChange(true)}
          onPointerLeave={() => onActionEngagementChange(false)}
          onFocusCapture={() => onActionEngagementChange(true)}
          onBlurCapture={() => onActionEngagementChange(false)}
        >
          <button
            type="button"
            className={`boundary-toggle-action ${remove ? "is-remove" : "is-add"}`}
            data-boundary-action={candidate.action}
            aria-label={remove ? "Remove wall and create an opening" : "Add wall and seal this opening"}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onApply();
            }}
          >
            <span aria-hidden="true">{remove ? "−" : "+"}</span>
            {remove ? "Remove wall" : "Add wall"}
          </button>
        </div>
      </Html>
    </group>
  );
}

function GroundInteraction({ world, mode, tool, residentRadius, activationVerb, onApply, onBoundaryEdit, onSelectNear }: { world: WorldStatic; mode: ExperienceMode; tool: InterventionTool; residentRadius?: number; activationVerb: "Click" | "Tap"; onApply: (point: Vec2) => void; onBoundaryEdit: (action: BoundaryEditAction, point: Vec2) => void; onSelectNear: (point: Vec2) => void }) {
  const [placementPreview, setPlacementPreview] = useState<{ point: Vec2; valid: boolean; reason: string }>();
  const [boundaryCandidate, setBoundaryCandidate] = useState<BoundaryEditCandidate>();
  const boundaryCandidateRef = useRef<BoundaryEditCandidate | undefined>(undefined);
  const pendingBoundaryCandidate = useRef<BoundaryEditCandidate | undefined>(undefined);
  const pendingBoundaryKey = useRef<string | undefined>(undefined);
  const boundarySwapTimer = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);
  const boundaryActionEngaged = useRef(false);
  const pointerDown = useRef<{ x: number; y: number } | undefined>(undefined);
  const interactionIntent = groundInteractionIntent(mode, tool);
  const boundaryEditing = interactionIntent === "edit-boundary";
  const placementActive = interactionIntent === "place";
  const selectable = interactionIntent === "select";
  const boundaryDistance = activationVerb === "Tap" ? 6 : 4;
  const makePlacementPreview = (point: Vec2) => {
    if (!residentRadius) return { point, valid: false, reason: "Select a lifted citizen first." };
    const valid = !wallCollision(point, residentRadius * 1.09, world.walls);
    return { point, valid, reason: valid ? `${activationVerb} to return the citizen here.` : "This position overlaps a boundary." };
  };
  const clearBoundarySwap = useCallback(() => {
    if (boundarySwapTimer.current !== undefined) window.clearTimeout(boundarySwapTimer.current);
    boundarySwapTimer.current = undefined;
    pendingBoundaryCandidate.current = undefined;
    pendingBoundaryKey.current = undefined;
  }, []);
  const replaceBoundaryCandidate = useCallback((candidate: BoundaryEditCandidate | undefined) => {
    clearBoundarySwap();
    boundaryCandidateRef.current = candidate;
    setBoundaryCandidate(candidate);
  }, [clearBoundarySwap]);
  const updateDesktopBoundaryCandidate = useCallback((candidate: BoundaryEditCandidate | undefined) => {
    if (boundaryActionEngaged.current) return;
    const current = boundaryCandidateRef.current;
    if (current?.id === candidate?.id && current?.action === candidate?.action) {
      clearBoundarySwap();
      return;
    }
    if (!current) {
      replaceBoundaryCandidate(candidate);
      return;
    }
    const candidateKey = candidate ? `${candidate.id}:${candidate.action}` : "none";
    if (pendingBoundaryKey.current === candidateKey) return;
    clearBoundarySwap();
    pendingBoundaryCandidate.current = candidate;
    pendingBoundaryKey.current = candidateKey;
    boundarySwapTimer.current = window.setTimeout(() => {
      if (boundaryActionEngaged.current) return;
      boundaryCandidateRef.current = pendingBoundaryCandidate.current;
      setBoundaryCandidate(pendingBoundaryCandidate.current);
      boundarySwapTimer.current = undefined;
      pendingBoundaryCandidate.current = undefined;
      pendingBoundaryKey.current = undefined;
    }, 550);
  }, [clearBoundarySwap, replaceBoundaryCandidate]);

  useEffect(() => {
    replaceBoundaryCandidate(undefined);
    setPlacementPreview(undefined);
  }, [boundaryEditing, placementActive, replaceBoundaryCandidate, world.topologyVersion]);

  useEffect(() => () => clearBoundarySwap(), [clearBoundarySwap]);

  return (
    <>
      <mesh
        position={[0, 0.11, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => {
          if (!boundaryEditing && !placementActive && !selectable) return;
          pointerDown.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          const point = { x: event.point.x, z: event.point.z };
          if (boundaryEditing && activationVerb === "Click") {
            updateDesktopBoundaryCandidate(resolveBoundaryEditCandidate(world, point, boundaryDistance));
          }
          else if (placementActive) setPlacementPreview(makePlacementPreview(point));
        }}
        onPointerUp={(event: ThreeEvent<PointerEvent>) => {
          if ((!boundaryEditing && !placementActive && !selectable) || !pointerDown.current) return;
          const distance = Math.hypot(event.clientX - pointerDown.current.x, event.clientY - pointerDown.current.y);
          pointerDown.current = undefined;
          if (selectable) {
            if (distance < (activationVerb === "Tap" ? 16 : 7)) onSelectNear({ x: event.point.x, z: event.point.z });
            return;
          }
          if (boundaryEditing) {
            if (distance < (activationVerb === "Tap" ? 16 : 7)) {
              replaceBoundaryCandidate(resolveBoundaryEditCandidate(world, { x: event.point.x, z: event.point.z }, boundaryDistance));
            }
            return;
          }
          const preview = makePlacementPreview({ x: event.point.x, z: event.point.z });
          if (distance < (activationVerb === "Tap" ? 14 : 5) && preview.valid) {
            setPlacementPreview(undefined);
            onApply(preview.point);
          } else setPlacementPreview(preview);
        }}
      >
        <planeGeometry args={[world.bounds.maxX - world.bounds.minX, world.bounds.maxZ - world.bounds.minZ]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {placementActive && placementPreview && (
        <group position={[placementPreview.point.x, 0.14, placementPreview.point.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.25, 1.45, 40]} />
            <meshBasicMaterial color={placementPreview.valid ? "#3f716b" : "#b9654a"} toneMapped={false} />
          </mesh>
          <Text font={besleyFont} fontSize={0.62} color={placementPreview.valid ? "#315d57" : "#8b3f32"} anchorX="center" anchorY="bottom" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -1.8]}>
            {placementPreview.reason}
          </Text>
        </group>
      )}
      {boundaryEditing && boundaryCandidate && (
        <BoundaryEditHighlight
          candidate={boundaryCandidate}
          onActionEngagementChange={(engaged) => {
            boundaryActionEngaged.current = engaged;
            if (engaged) clearBoundarySwap();
          }}
          onApply={() => {
            replaceBoundaryCandidate(undefined);
            onBoundaryEdit(boundaryCandidate.action, boundaryCandidate.point);
          }}
        />
      )}
    </>
  );
}

function Scene(props: SceneProps) {
  const controls = useRef<any>(null);
  const manualLookUntil = useRef(0);
  const orbitEnabled = props.experience.cameraMode !== "native";
  const surveyOrbit = props.experience.cameraMode === "survey" || props.experience.cameraMode === "framed";
  const constrainSurveyOrbit = () => {
    const orbit = controls.current;
    if (!surveyOrbit || !orbit) return;

    const camera = orbit.object as THREE.Camera;
    const clampedTarget = clampSurveyTarget(props.world.bounds, orbit.target);
    const correctionX = clampedTarget.x - orbit.target.x;
    const correctionZ = clampedTarget.z - orbit.target.z;
    if (correctionX || correctionZ) {
      orbit.target.x = clampedTarget.x;
      orbit.target.z = clampedTarget.z;
      camera.position.x += correctionX;
      camera.position.z += correctionZ;
    }

  };
  const selectNearestResident = (point: Vec2) => {
    if (!props.snapshot) return;
    let nearestId: number | null = null;
    let nearestDistance = props.activationVerb === "Tap" ? 5 : 3.25;
    for (const resident of props.residents) {
      const pose = residentPose(props.snapshot, resident.id);
      if (!pose) continue;
      const distance = Math.hypot(pose.x - point.x, pose.z - point.z);
      if (distance < nearestDistance) {
        nearestId = resident.id;
        nearestDistance = distance;
      }
    }
    if (nearestId !== null) props.onSelect(nearestId);
  };
  return (
    <>
      <CameraSet projection={props.experience.projection} />
      <fog attach="fog" args={["#c8c0aa", 280, 500]} />
      <ambientLight intensity={0.72} color="#fff8e8" />
      <hemisphereLight intensity={0.52} color="#fff7df" groundColor="#4c514d" />
      <directionalLight position={[-35, 55, 22]} intensity={1.45} color="#fff2ce" castShadow={props.quality !== "lite"} shadow-mapSize={[1536, 1536]} shadow-camera-far={180} shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={62} shadow-camera-bottom={-62} />
      <Suspense fallback={null}>
        {props.world.surfaces.map((surface, layer) => <SurfaceMesh key={surface.id} surface={surface} layer={layer} />)}
      </Suspense>
      {props.world.walls.map((wall) => <Boundary key={wall.id} wall={wall} />)}
      <PortalTicks world={props.world} />
      <StreetLabels surfaces={props.world.surfaces} />
      <PlaceLabels world={props.world} />
      <BuildingLabels buildings={props.world.buildings} />
      <DestinationPulse world={props.world} snapshot={props.snapshot} selectedId={props.experience.selectedResidentId} />
      {props.previewTarget && <TargetPreviewMarker point={props.previewTarget} />}
      <Residents
        residents={props.residents}
        snapshot={props.snapshot}
        selectedId={props.experience.selectedResidentId}
        onSelect={props.onSelect}
        interactive={props.experience.carriedResidentId === null && props.experience.mode !== "intervene" && !(["cut", "seal", "reinsert"] as string[]).includes(props.experience.interventionTool)}
      />
      <GroundInteraction
        world={props.world}
        mode={props.experience.mode}
        tool={props.experience.interventionTool}
        residentRadius={props.experience.selectedResidentId === null ? undefined : props.residents[props.experience.selectedResidentId]?.radius}
        activationVerb={props.activationVerb ?? "Click"}
        onApply={props.onWorldPoint}
        onBoundaryEdit={props.onBoundaryEdit}
        onSelectNear={selectNearestResident}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={orbitEnabled}
        enablePan={surveyOrbit}
        minDistance={surveyOrbit ? SURVEY_MIN_DISTANCE : 4}
        maxDistance={surveyOrbit ? SURVEY_MAX_DISTANCE : 80}
        maxPolarAngle={THREE.MathUtils.degToRad(surveyOrbit ? SURVEY_MAX_POLAR_DEGREES : 75)}
        minPolarAngle={THREE.MathUtils.degToRad(surveyOrbit ? SURVEY_MIN_POLAR_DEGREES : 12)}
        enableDamping
        dampingFactor={0.09}
        mouseButtons={{ LEFT: surveyOrbit ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        onChange={constrainSurveyOrbit}
        onStart={() => {
          manualLookUntil.current = Number.POSITIVE_INFINITY;
          props.onCameraInteraction();
        }}
        onEnd={() => { manualLookUntil.current = performance.now() + 1200; }}
      />
      <CameraController
        snapshot={props.snapshot}
        experience={props.experience}
        cameraInput={props.cameraInput}
        frameSignal={props.frameSignal}
        resetSignal={props.resetSignal}
        restorePose={props.restorePose}
        restorePoseSignal={props.restorePoseSignal}
        controls={controls}
        manualLookUntil={manualLookUntil}
        onCameraPose={props.onCameraPose}
      />
    </>
  );
}

export function FlatworldScene(props: SceneProps) {
  return (
    <Canvas
      id="flatworld-canvas"
      tabIndex={0}
      aria-label="Interactive map of Flatland"
      onContextMenu={(event) => event.preventDefault()}
      shadows={props.quality !== "lite"}
      dpr={props.quality === "cinematic" ? [1, 2] : [1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance", toneMapping: THREE.AgXToneMapping }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
