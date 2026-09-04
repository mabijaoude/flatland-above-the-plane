import type { Portal, Vec2, Venue, Wall } from "../types";
import { nearestWall } from "./geometry";

export const EDITABLE_OPENING_WIDTH = 4.4;
export const MINIMUM_WALL_REMAINDER = 1.5;

const GEOMETRY_EPSILON = 0.000001;

type BoundaryVenue = Pick<Venue, "regionId" | "center" | "size">;

type OpeningSegment = {
  point: Vec2;
  a: Vec2;
  b: Vec2;
};

function distance(a: Vec2, b: Vec2) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function samePoint(a: Vec2, b: Vec2) {
  return distance(a, b) <= GEOMETRY_EPSILON;
}

function sameRegions(a: Portal, b: Portal) {
  return (a.regionA === b.regionA && a.regionB === b.regionB)
    || (a.regionA === b.regionB && a.regionB === b.regionA);
}

function portalBelongsToWall(portal: Portal, wall: Wall) {
  return portal.regionA === wall.buildingId || portal.regionB === wall.buildingId;
}

function segmentBasis(a: Vec2, b: Vec2) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length <= GEOMETRY_EPSILON) return undefined;
  return { length, ux: dx / length, uz: dz / length };
}

function projection(point: Vec2, origin: Vec2, ux: number, uz: number) {
  return (point.x - origin.x) * ux + (point.z - origin.z) * uz;
}

function pointOnLine(point: Vec2, origin: Vec2, ux: number, uz: number) {
  return Math.abs((point.x - origin.x) * uz - (point.z - origin.z) * ux) <= GEOMETRY_EPSILON;
}

function projectedInterval(a: Vec2, b: Vec2, origin: Vec2, ux: number, uz: number): [number, number] {
  const first = projection(a, origin, ux, uz);
  const second = projection(b, origin, ux, uz);
  return first <= second ? [first, second] : [second, first];
}

function pointAt(origin: Vec2, ux: number, uz: number, amount: number): Vec2 {
  return { x: origin.x + ux * amount, z: origin.z + uz * amount };
}

function clampSegmentToVenue<T extends { a: Vec2; b: Vec2 }>(segment: T, venue: BoundaryVenue | undefined): T | undefined {
  if (!venue) return { ...segment, a: { ...segment.a }, b: { ...segment.b } };
  const left = venue.center.x - venue.size.x / 2;
  const right = venue.center.x + venue.size.x / 2;
  const top = venue.center.z - venue.size.z / 2;
  const bottom = venue.center.z + venue.size.z / 2;
  const horizontal = Math.abs(segment.b.x - segment.a.x) >= Math.abs(segment.b.z - segment.a.z);
  const clampPoint = (point: Vec2): Vec2 => horizontal
    ? { x: Math.max(left, Math.min(right, point.x)), z: point.z }
    : { x: point.x, z: Math.max(top, Math.min(bottom, point.z)) };
  const a = clampPoint(segment.a);
  const b = clampPoint(segment.b);
  if (samePoint(a, b)) return undefined;
  return { ...segment, a, b };
}

export function openingSegmentAt(wall: Wall, target: Vec2, width = EDITABLE_OPENING_WIDTH): OpeningSegment | undefined {
  const basis = segmentBasis(wall.a, wall.b);
  if (!basis || basis.length < width + 1.2) return undefined;

  const half = Math.min(width / 2, basis.length * 0.32);
  const rawCenter = projection(target, wall.a, basis.ux, basis.uz);
  const center = Math.max(half, Math.min(basis.length - half, rawCenter));
  let start = center - half;
  let end = center + half;

  if (start > GEOMETRY_EPSILON && start < MINIMUM_WALL_REMAINDER) start = 0;
  const trailing = basis.length - end;
  if (trailing > GEOMETRY_EPSILON && trailing < MINIMUM_WALL_REMAINDER) end = basis.length;

  const a = pointAt(wall.a, basis.ux, basis.uz, start);
  const b = pointAt(wall.a, basis.ux, basis.uz, end);
  return { point: pointAt(wall.a, basis.ux, basis.uz, (start + end) / 2), a, b };
}

/**
 * Repairs topology written by older builds whose edge projection could extend a
 * new opening beyond the wall being cut. The repair is conservative: it clamps
 * segments to their venue, joins only genuinely overlapping openings, and lets
 * openings win over wall pieces occupying the same span.
 */
export function repairBoundaryTopology(walls: Wall[], portals: Portal[], venues: BoundaryVenue[] = []) {
  const venueByRegion = new Map(venues.map((venue) => [venue.regionId, venue]));
  let changed = false;
  const repairedPortals = portals.flatMap((portal) => {
    const venue = venueByRegion.get(portal.regionA) ?? venueByRegion.get(portal.regionB);
    const clamped = clampSegmentToVenue(portal, venue);
    if (!clamped) {
      changed = true;
      return [];
    }
    if (!samePoint(clamped.a, portal.a) || !samePoint(clamped.b, portal.b)) changed = true;
    return [clamped];
  }).sort((a, b) => a.id - b.id);

  let merged = true;
  while (merged) {
    merged = false;
    for (let firstIndex = 0; firstIndex < repairedPortals.length && !merged; firstIndex += 1) {
      const first = repairedPortals[firstIndex];
      const basis = segmentBasis(first.a, first.b);
      if (!basis) continue;
      for (let secondIndex = firstIndex + 1; secondIndex < repairedPortals.length; secondIndex += 1) {
        const second = repairedPortals[secondIndex];
        if (!sameRegions(first, second)
          || !pointOnLine(second.a, first.a, basis.ux, basis.uz)
          || !pointOnLine(second.b, first.a, basis.ux, basis.uz)) continue;
        const [secondStart, secondEnd] = projectedInterval(second.a, second.b, first.a, basis.ux, basis.uz);
        const overlap = Math.min(basis.length, secondEnd) - Math.max(0, secondStart);
        if (overlap <= GEOMETRY_EPSILON) continue;
        const start = Math.min(0, secondStart);
        const end = Math.max(basis.length, secondEnd);
        repairedPortals[firstIndex] = {
          ...first,
          a: pointAt(first.a, basis.ux, basis.uz, start),
          b: pointAt(first.a, basis.ux, basis.uz, end),
          sourceWallId: first.sourceWallId ?? second.sourceWallId
        };
        repairedPortals.splice(secondIndex, 1);
        changed = true;
        merged = true;
        break;
      }
    }
  }

  let nextWallId = Math.max(0, ...walls.map((wall) => wall.id)) + 1;
  const repairedWalls: Wall[] = [];
  for (const wall of walls) {
    const clamped = clampSegmentToVenue(wall, venueByRegion.get(wall.buildingId));
    if (!clamped) {
      changed = true;
      continue;
    }
    if (!samePoint(clamped.a, wall.a) || !samePoint(clamped.b, wall.b)) changed = true;
    const basis = segmentBasis(clamped.a, clamped.b);
    if (!basis) {
      changed = true;
      continue;
    }
    const blocked = repairedPortals.flatMap((portal) => {
      if (!portalBelongsToWall(portal, clamped)
        || !pointOnLine(portal.a, clamped.a, basis.ux, basis.uz)
        || !pointOnLine(portal.b, clamped.a, basis.ux, basis.uz)) return [];
      const [rawStart, rawEnd] = projectedInterval(portal.a, portal.b, clamped.a, basis.ux, basis.uz);
      const start = Math.max(0, rawStart);
      const end = Math.min(basis.length, rawEnd);
      return end - start > GEOMETRY_EPSILON ? [[start, end] as [number, number]] : [];
    }).sort((a, b) => a[0] - b[0]);

    if (!blocked.length) {
      repairedWalls.push(clamped);
      continue;
    }

    const covered: Array<[number, number]> = [];
    for (const interval of blocked) {
      const previous = covered.at(-1);
      if (previous && interval[0] <= previous[1] + GEOMETRY_EPSILON) previous[1] = Math.max(previous[1], interval[1]);
      else covered.push([...interval]);
    }
    let cursor = 0;
    let emitted = 0;
    for (const [start, end] of covered) {
      if (start - cursor > GEOMETRY_EPSILON) {
        repairedWalls.push({
          ...clamped,
          id: emitted === 0 ? clamped.id : nextWallId++,
          a: pointAt(clamped.a, basis.ux, basis.uz, cursor),
          b: pointAt(clamped.a, basis.ux, basis.uz, start)
        });
        emitted += 1;
      }
      cursor = Math.max(cursor, end);
    }
    if (basis.length - cursor > GEOMETRY_EPSILON) {
      repairedWalls.push({
        ...clamped,
        id: emitted === 0 ? clamped.id : nextWallId++,
        a: pointAt(clamped.a, basis.ux, basis.uz, cursor),
        b: pointAt(clamped.a, basis.ux, basis.uz, basis.length)
      });
    }
    changed = true;
  }

  return { walls: repairedWalls, portals: repairedPortals, changed };
}

export function connectedRegions(start: number, portals: Portal[]): Set<number> {
  const visited = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const region = queue.shift()!;
    for (const portal of portals) {
      const next = portal.regionA === region ? portal.regionB : portal.regionB === region ? portal.regionA : undefined;
      if (next === undefined || visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited;
}

export function findRegionPath(start: number, target: number, portals: Portal[], requiredWidth = 0): number[] {
  if (start === target) return [start];
  const queue = [start];
  const previous = new Map<number, number>();
  const visited = new Set<number>([start]);
  while (queue.length) {
    const region = queue.shift()!;
    for (const portal of portals) {
      const width = Math.hypot(portal.b.x - portal.a.x, portal.b.z - portal.a.z);
      if (width < requiredWidth) continue;
      const next = portal.regionA === region ? portal.regionB : portal.regionB === region ? portal.regionA : undefined;
      if (next === undefined || visited.has(next)) continue;
      previous.set(next, region);
      if (next === target) {
        const path = [target];
        let cursor = target;
        while (previous.has(cursor)) {
          cursor = previous.get(cursor)!;
          path.unshift(cursor);
        }
        return path;
      }
      visited.add(next);
      queue.push(next);
    }
  }
  return [];
}

export function createOpeningAt(target: Vec2, walls: Wall[], portals: Portal[], nextPortalId: number, width = 3.2) {
  const wall = nearestWall(target, walls);
  if (!wall) return undefined;
  const opening = openingSegmentAt(wall, target, width);
  if (!opening) return undefined;
  const remaining = walls.filter((item) => item.id !== wall.id);
  const nextWallId = Math.max(0, ...walls.map((item) => item.id)) + 1;
  if (distance(wall.a, opening.a) > GEOMETRY_EPSILON) remaining.push({ ...wall, id: nextWallId, b: opening.a });
  if (distance(opening.b, wall.b) > GEOMETRY_EPSILON) remaining.push({ ...wall, id: nextWallId + 1, a: opening.b });
  const portal: Portal = {
    id: nextPortalId,
    a: opening.a,
    b: opening.b,
    regionA: 0,
    regionB: wall.buildingId > 0 ? wall.buildingId : 0,
    sourceWallId: wall.id
  };
  return { walls: remaining, portals: [...portals, portal], portal };
}
