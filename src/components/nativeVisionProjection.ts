import type { Vec2 } from "../types";

export const NATIVE_VISION_FIELD_OF_VIEW = Math.PI * 0.96;
export const NATIVE_VISION_RESIDENT_RANGE = 34;

export type NativeVisionBody = {
  id: number;
  center: Vec2;
  rotation: number;
  sides: number;
  radius: number;
};

export type NativeVisionRayHit = {
  bodyId: number;
  distance: number;
};

type ProjectionInput = {
  origin: Vec2;
  viewRotation: number;
  rayCount: number;
  bodies: readonly NativeVisionBody[];
  occluderDistances: ArrayLike<number>;
  fieldOfView?: number;
  maximumDistance?: number;
};

function edgeIntersectionDistance(
  origin: Vec2,
  direction: Vec2,
  a: Vec2,
  b: Vec2,
  maximumDistance: number
) {
  const sx = b.x - a.x;
  const sz = b.z - a.z;
  const determinant = direction.x * sz - direction.z * sx;
  if (Math.abs(determinant) < 0.000001) return maximumDistance;
  const ax = a.x - origin.x;
  const az = a.z - origin.z;
  const rayT = (ax * sz - az * sx) / determinant;
  const segmentT = (ax * direction.z - az * direction.x) / determinant;
  return rayT >= 0 && rayT <= maximumDistance && segmentT >= 0 && segmentT <= 1
    ? rayT
    : maximumDistance;
}

export function regularPolygonVertices(body: NativeVisionBody): Vec2[] {
  const sides = Math.max(3, Math.floor(body.sides));
  return Array.from({ length: sides }, (_, index) => {
    const angle = body.rotation + index / sides * Math.PI * 2;
    return {
      x: body.center.x + Math.sin(angle) * body.radius,
      z: body.center.z + Math.cos(angle) * body.radius
    };
  });
}

export function rayPolygonDistance(
  origin: Vec2,
  direction: Vec2,
  vertices: readonly Vec2[],
  maximumDistance: number
) {
  let nearest = maximumDistance;
  for (let index = 0; index < vertices.length; index += 1) {
    nearest = Math.min(
      nearest,
      edgeIntersectionDistance(
        origin,
        direction,
        vertices[index],
        vertices[(index + 1) % vertices.length],
        nearest
      )
    );
  }
  return nearest;
}

export function projectNativeVisionBodies({
  origin,
  viewRotation,
  rayCount,
  bodies,
  occluderDistances,
  fieldOfView = NATIVE_VISION_FIELD_OF_VIEW,
  maximumDistance = NATIVE_VISION_RESIDENT_RANGE
}: ProjectionInput): Array<NativeVisionRayHit | undefined> {
  if (rayCount < 2) return [];
  const prepared = bodies
    .filter((body) => body.sides >= 3 && body.radius > 0)
    .map((body) => ({ body, vertices: regularPolygonVertices(body) }));

  return Array.from({ length: rayCount }, (_, index) => {
    const angle = viewRotation - fieldOfView / 2 + index / (rayCount - 1) * fieldOfView;
    const direction = { x: Math.sin(angle), z: Math.cos(angle) };
    let nearestDistance = Math.min(occluderDistances[index] ?? maximumDistance, maximumDistance);
    let nearestBodyId: number | undefined;

    for (const candidate of prepared) {
      const dx = candidate.body.center.x - origin.x;
      const dz = candidate.body.center.z - origin.z;
      const alongRay = dx * direction.x + dz * direction.z;
      if (alongRay + candidate.body.radius <= 0 || alongRay - candidate.body.radius >= nearestDistance) continue;
      const perpendicularDistance = Math.abs(dx * direction.z - dz * direction.x);
      if (perpendicularDistance > candidate.body.radius) continue;

      const distance = rayPolygonDistance(origin, direction, candidate.vertices, nearestDistance);
      if (distance < nearestDistance - 0.001) {
        nearestDistance = distance;
        nearestBodyId = candidate.body.id;
      }
    }

    return nearestBodyId === undefined ? undefined : { bodyId: nearestBodyId, distance: nearestDistance };
  });
}
