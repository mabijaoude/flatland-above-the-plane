import type { Portal, Vec2, WorldStatic } from "../types";
import { wallCollision } from "./geometry";
import { findRegionPath } from "./topology";

const CELL = 1.5;
const CLEARANCE = 0.12;
const DIRECTIONS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
] as const;

type Grid = {
  columns: number;
  rows: number;
  blocked: Uint8Array;
  weight: Float32Array;
};

type HeapEntry = { index: number; score: number };

class MinHeap {
  private values: HeapEntry[] = [];

  get size() {
    return this.values.length;
  }

  push(value: HeapEntry) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].score <= value.score) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop() {
    if (!this.values.length) return undefined;
    const root = this.values[0];
    const tail = this.values.pop()!;
    if (this.values.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        const child = right < this.values.length && this.values[right].score < this.values[left].score ? right : left;
        if (this.values[child].score >= tail.score) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = tail;
    }
    return root;
  }
}

const gridCache = new WeakMap<WorldStatic, Map<number, Grid>>();

function radiusClass(radius: number) {
  return Math.ceil((radius + CLEARANCE) * 4) / 4;
}

function gridPoint(world: WorldStatic, x: number, z: number): Vec2 {
  return { x: world.bounds.minX + x * CELL, z: world.bounds.minZ + z * CELL };
}

function toGrid(world: WorldStatic, point: Vec2) {
  return {
    x: Math.round((point.x - world.bounds.minX) / CELL),
    z: Math.round((point.z - world.bounds.minZ) / CELL)
  };
}

function pointWeight(world: WorldStatic, point: Vec2) {
  let weight = 1.35;
  for (const surface of world.surfaces) {
    if (
      Math.abs(point.x - surface.center.x) <= surface.size.x / 2
      && Math.abs(point.z - surface.center.z) <= surface.size.z / 2
    ) weight = Math.min(weight, surface.pathWeight);
  }
  return weight;
}

function navigationGrid(world: WorldStatic, radius: number): Grid {
  const clearance = radiusClass(radius);
  const cachedForWorld = gridCache.get(world) ?? new Map<number, Grid>();
  gridCache.set(world, cachedForWorld);
  const existing = cachedForWorld.get(clearance);
  if (existing) return existing;
  const columns = Math.floor((world.bounds.maxX - world.bounds.minX) / CELL) + 1;
  const rows = Math.floor((world.bounds.maxZ - world.bounds.minZ) / CELL) + 1;
  const blocked = new Uint8Array(columns * rows);
  const weight = new Float32Array(columns * rows);
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < columns; x += 1) {
      const index = z * columns + x;
      const point = gridPoint(world, x, z);
      blocked[index] = wallCollision(point, clearance, world.walls) ? 1 : 0;
      weight[index] = pointWeight(world, point);
    }
  }
  const grid = { columns, rows, blocked, weight };
  cachedForWorld.set(clearance, grid);
  return grid;
}

export function regionAtPoint(world: WorldStatic, point: Vec2): number {
  const building = world.buildings.find((candidate) => (
    point.x > candidate.center.x - candidate.size.x / 2
    && point.x < candidate.center.x + candidate.size.x / 2
    && point.z > candidate.center.z - candidate.size.z / 2
    && point.z < candidate.center.z + candidate.size.z / 2
  ));
  return building?.regionId ?? 0;
}

export function lineClear(world: WorldStatic, start: Vec2, end: Vec2, radius: number): boolean {
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  const samples = Math.max(2, Math.ceil(distance / 0.55));
  for (let index = 1; index < samples; index += 1) {
    const amount = index / samples;
    const point = { x: start.x + (end.x - start.x) * amount, z: start.z + (end.z - start.z) * amount };
    if (wallCollision(point, radius + CLEARANCE, world.walls)) return false;
  }
  return true;
}

function simplify(world: WorldStatic, path: Vec2[], radius: number): Vec2[] {
  if (path.length <= 2) return path;
  const result = [path[0]];
  let cursor = 0;
  while (cursor < path.length - 1) {
    let next = path.length - 1;
    while (next > cursor + 1 && !lineClear(world, path[cursor], path[next], radius)) next -= 1;
    result.push(path[next]);
    cursor = next;
  }
  return result;
}

function rawPath(world: WorldStatic, start: Vec2, target: Vec2, radius: number): Vec2[] {
  const startRegion = regionAtPoint(world, start);
  const targetRegion = regionAtPoint(world, target);
  if (!findRegionPath(startRegion, targetRegion, world.portals, radius * 2 + 0.18).length) return [];
  if (lineClear(world, start, target, radius)) return [target];

  const grid = navigationGrid(world, radius);
  const startCell = toGrid(world, start);
  const targetCell = toGrid(world, target);
  const startIndex = startCell.z * grid.columns + startCell.x;
  const targetIndex = targetCell.z * grid.columns + targetCell.x;
  const count = grid.columns * grid.rows;
  const gScore = new Float64Array(count);
  const fScore = new Float64Array(count);
  const parent = new Int32Array(count);
  const closed = new Uint8Array(count);
  gScore.fill(Number.POSITIVE_INFINITY);
  fScore.fill(Number.POSITIVE_INFINITY);
  parent.fill(-1);
  gScore[startIndex] = 0;
  fScore[startIndex] = Math.hypot(startCell.x - targetCell.x, startCell.z - targetCell.z);
  const open = new MinHeap();
  open.push({ index: startIndex, score: fScore[startIndex] });
  let iterations = 0;

  while (open.size && iterations < count * 4) {
    iterations += 1;
    const entry = open.pop();
    if (!entry || closed[entry.index]) continue;
    if (entry.score > fScore[entry.index] + 0.0001) continue;
    closed[entry.index] = 1;
    const x = entry.index % grid.columns;
    const z = Math.floor(entry.index / grid.columns);
    const currentPoint = entry.index === startIndex ? start : gridPoint(world, x, z);
    if (entry.index === targetIndex || lineClear(world, currentPoint, target, radius)) {
      const points: Vec2[] = [target];
      let cursor = entry.index;
      while (cursor !== startIndex && cursor >= 0) {
        const cursorX = cursor % grid.columns;
        const cursorZ = Math.floor(cursor / grid.columns);
        points.unshift(gridPoint(world, cursorX, cursorZ));
        cursor = parent[cursor];
      }
      points.unshift(start);
      return simplify(world, points, radius).slice(1);
    }

    for (const [dx, dz] of DIRECTIONS) {
      const nextX = x + dx;
      const nextZ = z + dz;
      if (nextX < 0 || nextZ < 0 || nextX >= grid.columns || nextZ >= grid.rows) continue;
      const nextIndex = nextZ * grid.columns + nextX;
      if (closed[nextIndex] || (grid.blocked[nextIndex] && nextIndex !== targetIndex)) continue;
      if (dx && dz) {
        const horizontal = z * grid.columns + nextX;
        const vertical = nextZ * grid.columns + x;
        if (grid.blocked[horizontal] || grid.blocked[vertical]) continue;
      }
      const distance = dx && dz ? Math.SQRT2 : 1;
      const tentative = gScore[entry.index] + distance * grid.weight[nextIndex];
      if (tentative >= gScore[nextIndex]) continue;
      parent[nextIndex] = entry.index;
      gScore[nextIndex] = tentative;
      fScore[nextIndex] = tentative + Math.hypot(nextX - targetCell.x, nextZ - targetCell.z);
      open.push({ index: nextIndex, score: fScore[nextIndex] });
    }
  }
  return [];
}

export function findPath(world: WorldStatic, start: Vec2, target: Vec2, radius: number): Vec2[] {
  const startRegion = regionAtPoint(world, start);
  const targetRegion = regionAtPoint(world, target);
  if (startRegion === targetRegion) return rawPath(world, start, target, radius);

  const requiredWidth = radius * 2 + 0.18;
  const regions = findRegionPath(startRegion, targetRegion, world.portals, requiredWidth);
  if (!regions.length) return [];
  const route: Vec2[] = [];
  let cursor = start;

  const append = (points: Vec2[]) => {
    for (const point of points) {
      const previous = route.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.z - previous.z) > 0.05) route.push(point);
    }
  };

  const portalCenter = (portal: Portal) => ({
    x: (portal.a.x + portal.b.x) / 2,
    z: (portal.a.z + portal.b.z) / 2
  });

  const portalStages = (portal: Portal, fromRegion: number, toRegion: number) => {
    const originalVenue = world.buildings.find((venue) => venue.entrance.portalId === portal.id);
    if (originalVenue) {
      const fromInside = fromRegion === originalVenue.regionId;
      return {
        from: fromInside ? originalVenue.entrance.insideStage : originalVenue.entrance.outsideStage,
        center: originalVenue.entrance.center,
        to: fromInside ? originalVenue.entrance.outsideStage : originalVenue.entrance.insideStage
      };
    }

    const center = portalCenter(portal);
    const dx = portal.b.x - portal.a.x;
    const dz = portal.b.z - portal.a.z;
    const length = Math.max(0.0001, Math.hypot(dx, dz));
    const distance = Math.max(1.25, radius + 0.55);
    const first = { x: center.x - dz / length * distance, z: center.z + dx / length * distance };
    const second = { x: center.x + dz / length * distance, z: center.z - dx / length * distance };
    const pointForRegion = (region: number) => {
      if (regionAtPoint(world, first) === region) return first;
      if (regionAtPoint(world, second) === region) return second;
      const venue = world.buildings.find((candidate) => candidate.regionId === region);
      if (!venue) return regionAtPoint(world, first) === 0 ? first : second;
      return Math.hypot(first.x - venue.center.x, first.z - venue.center.z)
        < Math.hypot(second.x - venue.center.x, second.z - venue.center.z)
        ? first
        : second;
    };
    return { from: pointForRegion(fromRegion), center, to: pointForRegion(toRegion) };
  };

  for (let index = 0; index < regions.length - 1; index += 1) {
    const fromRegion = regions[index];
    const toRegion = regions[index + 1];
    const candidates = world.portals
      .filter((portal) => {
        const connects = (portal.regionA === fromRegion && portal.regionB === toRegion)
          || (portal.regionB === fromRegion && portal.regionA === toRegion);
        return connects && Math.hypot(portal.b.x - portal.a.x, portal.b.z - portal.a.z) >= requiredWidth;
      })
      .sort((first, second) => {
        const a = portalCenter(first);
        const b = portalCenter(second);
        return Math.hypot(cursor.x - a.x, cursor.z - a.z) + Math.hypot(target.x - a.x, target.z - a.z)
          - Math.hypot(cursor.x - b.x, cursor.z - b.z) - Math.hypot(target.x - b.x, target.z - b.z);
      });

    let crossed = false;
    for (const portal of candidates) {
      const stages = portalStages(portal, fromRegion, toRegion);
      const approach = rawPath(world, cursor, stages.from, radius);
      const alreadyThere = Math.hypot(cursor.x - stages.from.x, cursor.z - stages.from.z) <= 0.2;
      if ((!approach.length && !alreadyThere)
        || !lineClear(world, stages.from, stages.center, radius)
        || !lineClear(world, stages.center, stages.to, radius)) continue;
      append(approach);
      append([stages.center, stages.to]);
      cursor = stages.to;
      crossed = true;
      break;
    }
    if (!crossed) return [];
  }

  const finish = rawPath(world, cursor, target, radius);
  if (!finish.length && Math.hypot(cursor.x - target.x, cursor.z - target.z) > 0.2) return [];
  append(finish);
  return route;
}
