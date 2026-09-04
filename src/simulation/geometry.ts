import type { Vec2, Wall } from "../types";

export function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  if (!lengthSquared) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}

export function wallCollision(point: Vec2, radius: number, walls: Wall[]): boolean {
  return walls.some((wall) => distanceToSegment(point, wall.a, wall.b) < radius);
}

export function raySegmentDistance(origin: Vec2, direction: Vec2, wall: Wall, maxDistance: number): number {
  const sx = wall.b.x - wall.a.x;
  const sz = wall.b.z - wall.a.z;
  const determinant = direction.x * sz - direction.z * sx;
  if (Math.abs(determinant) < 0.000001) return maxDistance;
  const ax = wall.a.x - origin.x;
  const az = wall.a.z - origin.z;
  const rayT = (ax * sz - az * sx) / determinant;
  const segmentT = (ax * direction.z - az * direction.x) / determinant;
  return rayT >= 0 && rayT <= maxDistance && segmentT >= 0 && segmentT <= 1 ? rayT : maxDistance;
}

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

export function nearestWall(target: Vec2, walls: Wall[], maximum = 7): Wall | undefined {
  return walls.reduce<Wall | undefined>((best, wall) => {
    const distance = distanceToSegment(target, wall.a, wall.b);
    if (distance > maximum) return best;
    return !best || distance < distanceToSegment(target, best.a, best.b) ? wall : best;
  }, undefined);
}
