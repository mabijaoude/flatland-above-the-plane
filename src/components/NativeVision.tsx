import { useEffect, useRef, useState } from "react";
import { Eye, Map as MapIcon, Square } from "lucide-react";
import type { RenderSnapshot, ResidentStatic, WorldStatic } from "../types";
import { raySegmentDistance } from "../simulation/geometry";
import {
  NATIVE_VISION_FIELD_OF_VIEW,
  NATIVE_VISION_RESIDENT_RANGE,
  projectNativeVisionBodies,
  type NativeVisionBody,
  type NativeVisionRayHit
} from "./nativeVisionProjection";

type Props = {
  world: WorldStatic;
  residents: ResidentStatic[];
  snapshot?: RenderSnapshot;
  selectedId: number;
  onGuidedView: () => void;
  onOverheadView: () => void;
  onStopFollowing?: () => void;
  returnLabel?: string;
  showOverheadView?: boolean;
};

export function NativeVision({
  world,
  residents,
  snapshot,
  selectedId,
  onGuidedView,
  onOverheadView,
  onStopFollowing,
  returnLabel = "Return to chase",
  showOverheadView = true
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => layer.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const target = previousFocus.current;
      requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    };
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const redraw = () => setLayoutRevision((revision) => revision + 1);
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", redraw);
      return () => window.removeEventListener("resize", redraw);
    }
    const observer = new ResizeObserver(redraw);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !snapshot) return;
    const context = element.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(element.clientWidth);
    const height = Math.round(element.clientHeight);
    if (!width || !height) return;
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#11140f";
    context.fillRect(0, 0, width, height);
    const offset = selectedId * snapshot.stride;
    const origin = { x: snapshot.data[offset], z: snapshot.data[offset + 1] };
    const rotation = snapshot.data[offset + 2];
    const rays = Math.max(360, Math.ceil(width / 2));
    const wallDistances = new Float32Array(rays);
    for (let index = 0; index < rays; index += 1) {
      const angle = rotation - NATIVE_VISION_FIELD_OF_VIEW / 2 + index / (rays - 1) * NATIVE_VISION_FIELD_OF_VIEW;
      const direction = { x: Math.sin(angle), z: Math.cos(angle) };
      let distance = 62;
      for (const wall of world.walls) distance = Math.min(distance, raySegmentDistance(origin, direction, wall, 62));
      wallDistances[index] = distance;
      const x = index / rays * width;
      const brightness = 0.25 + (1 - distance / 62) * 0.72;
      context.fillStyle = `rgba(226, 199, 126, ${brightness})`;
      const lineHeight = 10 + (1 - distance / 62) * height * 0.62;
      context.fillRect(x, height / 2 - lineHeight / 2, Math.ceil(width / rays) + 1, lineHeight);
    }

    const visibleResidents = new Map<number, ResidentStatic>();
    const bodies: NativeVisionBody[] = [];
    residents.forEach((resident) => {
      if (resident.id === selectedId || resident.id >= snapshot.residentCount) return;
      const otherOffset = resident.id * snapshot.stride;
      if (snapshot.data[otherOffset + 4] !== 0) return;
      const center = { x: snapshot.data[otherOffset], z: snapshot.data[otherOffset + 1] };
      if (Math.hypot(center.x - origin.x, center.z - origin.z) - resident.radius > NATIVE_VISION_RESIDENT_RANGE) return;
      visibleResidents.set(resident.id, resident);
      bodies.push({
        id: resident.id,
        center,
        rotation: snapshot.data[otherOffset + 2],
        sides: resident.sides,
        radius: resident.radius
      });
    });

    const residentHits = projectNativeVisionBodies({
      origin,
      viewRotation: rotation,
      rayCount: rays,
      bodies,
      occluderDistances: wallDistances
    });
    const rayWidth = Math.ceil(width / rays) + 1;
    const segmentHeight = (hit: NativeVisionRayHit) => {
      const closeness = Math.max(0, 1 - hit.distance / NATIVE_VISION_RESIDENT_RANGE);
      return Math.min(height * 0.56, Math.max(54, height * (0.2 + closeness * 0.34)));
    };

    residentHits.forEach((hit, index) => {
      if (!hit) return;
      const resident = visibleResidents.get(hit.bodyId);
      if (!resident) return;
      const x = index / rays * width;
      const lineHeight = segmentHeight(hit);
      const closeness = Math.max(0, 1 - hit.distance / NATIVE_VISION_RESIDENT_RANGE);
      context.globalAlpha = 0.72 + closeness * 0.28;
      context.fillStyle = resident.color;
      context.fillRect(x, height / 2 - lineHeight / 2, rayWidth, lineHeight);
    });
    context.globalAlpha = 1;

    for (let start = 0; start < residentHits.length;) {
      const first = residentHits[start];
      if (!first) {
        start += 1;
        continue;
      }
      let end = start;
      while (end + 1 < residentHits.length && residentHits[end + 1]?.bodyId === first.bodyId) end += 1;
      context.beginPath();
      for (let index = start; index <= end; index += 1) {
        const hit = residentHits[index];
        if (!hit) continue;
        const x = index / rays * width;
        const lineHeight = segmentHeight(hit);
        if (index === start) context.moveTo(x, height / 2 - lineHeight / 2);
        else context.lineTo(x, height / 2 - lineHeight / 2);
      }
      for (let index = end; index >= start; index -= 1) {
        const hit = residentHits[index];
        if (!hit) continue;
        const x = (index + 1) / rays * width;
        const lineHeight = segmentHeight(hit);
        context.lineTo(x, height / 2 + lineHeight / 2);
      }
      context.closePath();
      context.strokeStyle = "rgba(17, 20, 15, .78)";
      context.lineWidth = 1.5;
      context.stroke();
      start = end + 1;
    }
  }, [world, residents, snapshot, selectedId, layoutRevision]);

  return (
    <section ref={layer} className="native-vision" aria-label="Strict native vision" tabIndex={-1}>
      <header className="native-vision__toolbar">
        <div className="native-vision__caption">
          <p>Strict native vision</p>
          <span>No above. No overview. Shapes widen as they approach; walls hide what lies beyond.</span>
        </div>
        <nav className="native-vision__view-switcher" aria-label="Choose another citizen view">
          <span>Change view</span>
          <button onClick={onGuidedView}><Eye />{returnLabel}</button>
          {showOverheadView && <button onClick={onOverheadView}><MapIcon />Overhead view</button>}
          {onStopFollowing && <button className="native-vision__stop" onClick={onStopFollowing}><Square />Stop following</button>}
        </nav>
      </header>
      <canvas ref={canvas} />
    </section>
  );
}
