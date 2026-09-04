import type { Vec2, Wall, WorldStatic } from "../types";
import { distanceToSegment, midpoint } from "../simulation/geometry";
import { openingSegmentAt } from "../simulation/topology";

export type BoundaryEditAction = "cut" | "seal";

export type BoundaryEditCandidate = {
  id: string;
  action: BoundaryEditAction;
  point: Vec2;
  a: Vec2;
  b: Vec2;
};

type BoundaryWorld = Pick<WorldStatic, "walls" | "portals">;

function openingPreview(wall: Wall, target: Vec2) {
  if (wall.reopens) {
    return { point: midpoint(wall.a, wall.b), a: wall.a, b: wall.b };
  }
  return openingSegmentAt(wall, target);
}

export function resolveBoundaryEditCandidate(world: BoundaryWorld, target: Vec2, maximumDistance = 4): BoundaryEditCandidate | undefined {
  const wall = world.walls.reduce<Wall | undefined>((best, candidate) => {
    if (!candidate.reopens && !openingSegmentAt(candidate, target)) return best;
    const distance = distanceToSegment(target, candidate.a, candidate.b);
    if (distance > maximumDistance) return best;
    return !best || distance < distanceToSegment(target, best.a, best.b) ? candidate : best;
  }, undefined);
  const portal = world.portals.reduce<(typeof world.portals)[number] | undefined>((best, candidate) => {
    const distance = distanceToSegment(target, candidate.a, candidate.b);
    if (distance > maximumDistance) return best;
    return !best || distance < distanceToSegment(target, best.a, best.b) ? candidate : best;
  }, undefined);

  const wallDistance = wall ? distanceToSegment(target, wall.a, wall.b) : Number.POSITIVE_INFINITY;
  const portalDistance = portal ? distanceToSegment(target, portal.a, portal.b) : Number.POSITIVE_INFINITY;
  if (portal && portalDistance <= wallDistance) {
    return {
      id: `portal-${portal.id}`,
      action: "seal",
      point: midpoint(portal.a, portal.b),
      a: portal.a,
      b: portal.b
    };
  }
  if (!wall) return undefined;
  const preview = openingPreview(wall, target);
  if (!preview) return undefined;
  return {
    id: `wall-${wall.id}`,
    action: "cut",
    ...preview
  };
}
