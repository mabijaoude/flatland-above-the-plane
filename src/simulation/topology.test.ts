import { describe, expect, it } from "vitest";
import type { Portal, Wall } from "../types";
import {
  connectedRegions,
  createOpeningAt,
  EDITABLE_OPENING_WIDTH,
  findRegionPath,
  MINIMUM_WALL_REMAINDER,
  openingSegmentAt,
  repairBoundaryTopology
} from "./topology";
import { buildWorld } from "./world";

function length(segment: { a: { x: number; z: number }; b: { x: number; z: number } }) {
  return Math.hypot(segment.b.x - segment.a.x, segment.b.z - segment.a.z);
}

function interval(segment: { a: { x: number; z: number }; b: { x: number; z: number } }) {
  const horizontal = Math.abs(segment.b.x - segment.a.x) >= Math.abs(segment.b.z - segment.a.z);
  const first = horizontal ? segment.a.x : segment.a.z;
  const second = horizontal ? segment.b.x : segment.b.z;
  return first <= second ? [first, second] : [second, first];
}

describe("town topology", () => {
  it("keeps the Closed Room unreachable until an opening is cut", () => {
    const { world } = buildWorld(1884);
    expect(connectedRegions(0, world.portals).has(world.sealedRoomId)).toBe(false);
    const room = world.buildings.find((building) => building.id === world.sealedRoomId)!;
    const changed = createOpeningAt(
      { x: room.center.x, z: room.center.z + room.size.z / 2 },
      world.walls,
      world.portals,
      999,
      4.4
    );
    expect(changed).toBeDefined();
    expect(connectedRegions(0, changed!.portals).has(world.sealedRoomId)).toBe(true);
  });

  it("makes every ordinary venue passable for the largest citizen", () => {
    const { world } = buildWorld(1884);
    const largestDiameterWithClearance = 2 * (0.72 + 12 * 0.035) + 0.18;
    for (const venue of world.buildings) {
      const path = findRegionPath(0, venue.regionId, world.portals, largestDiameterWithClearance);
      if (venue.id === world.sealedRoomId) expect(path).toEqual([]);
      else expect(path, `${venue.name} should have an accessible entrance`).toEqual([0, venue.regionId]);
    }
  });

  it("leaves the canonical building boundaries unchanged", () => {
    const { world } = buildWorld(1884);
    const repaired = repairBoundaryTopology(world.walls, world.portals, world.buildings);

    expect(repaired.changed).toBe(false);
    expect(repaired.walls).toEqual(world.walls);
    expect(repaired.portals).toEqual(world.portals);
  });

  it("keeps every edge cut within its source wall and avoids tiny remnants", () => {
    const { world } = buildWorld(1884);
    for (const wall of world.walls) {
      for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
        const target = {
          x: wall.a.x + (wall.b.x - wall.a.x) * fraction,
          z: wall.a.z + (wall.b.z - wall.a.z) * fraction
        };
        const planned = openingSegmentAt(wall, target, EDITABLE_OPENING_WIDTH);
        if (!planned) continue;
        const source = interval(wall);
        const opening = interval(planned);
        expect(opening[0], `opening starts inside wall ${wall.id}`).toBeGreaterThanOrEqual(source[0] - 0.000001);
        expect(opening[1], `opening ends inside wall ${wall.id}`).toBeLessThanOrEqual(source[1] + 0.000001);

        const changed = createOpeningAt(target, [wall], [], 999, EDITABLE_OPENING_WIDTH)!;
        for (const remainder of changed.walls) {
          expect(length(remainder), `wall ${wall.id} should not leave a visual sliver`).toBeGreaterThanOrEqual(MINIMUM_WALL_REMAINDER - 0.000001);
        }
        const coverage = [...changed.walls, changed.portal].map(interval).sort((a, b) => a[0] - b[0]);
        expect(coverage[0][0]).toBeCloseTo(source[0]);
        expect(coverage.at(-1)![1]).toBeCloseTo(source[1]);
        for (let index = 1; index < coverage.length; index += 1) {
          expect(coverage[index][0]).toBeCloseTo(coverage[index - 1][1]);
        }
      }
    }
  });

  it("opens the Institute frontage cleanly beside its original doorway", () => {
    const { world } = buildWorld(1884);
    const institute = world.buildings.find((venue) => venue.kind === "research")!;
    const top = institute.center.z - institute.size.z / 2;
    const originalPortal = world.portals.find((portal) => portal.regionB === institute.regionId)!;
    const leftWall = world.walls.find((wall) => wall.buildingId === institute.regionId
      && Math.abs(wall.a.z - top) < 0.000001
      && Math.abs(wall.b.x - originalPortal.a.x) < 0.000001)!;
    const rightWall = world.walls.find((wall) => wall.buildingId === institute.regionId
      && Math.abs(wall.a.z - top) < 0.000001
      && Math.abs(wall.a.x - originalPortal.b.x) < 0.000001)!;

    const first = createOpeningAt(leftWall.b, world.walls, world.portals, 900, EDITABLE_OPENING_WIDTH)!;
    const second = createOpeningAt(rightWall.a, first.walls, first.portals, 901, EDITABLE_OPENING_WIDTH)!;
    const northWalls = second.walls.filter((wall) => wall.buildingId === institute.regionId
      && Math.abs(wall.a.z - top) < 0.000001
      && Math.abs(wall.b.z - top) < 0.000001);
    const northPortals = second.portals.filter((portal) => portal.regionB === institute.regionId
      && Math.abs(portal.a.z - top) < 0.000001
      && Math.abs(portal.b.z - top) < 0.000001);

    expect(northWalls).toHaveLength(2);
    expect(northWalls.every((wall) => length(wall) >= MINIMUM_WALL_REMAINDER)).toBe(true);
    const coverage = [...northWalls, ...northPortals].map(interval).sort((a, b) => a[0] - b[0]);
    expect(coverage[0][0]).toBeCloseTo(institute.center.x - institute.size.x / 2);
    expect(coverage.at(-1)![1]).toBeCloseTo(institute.center.x + institute.size.x / 2);
    for (let index = 1; index < coverage.length; index += 1) {
      expect(coverage[index][0]).toBeCloseTo(coverage[index - 1][1]);
    }
  });

  it("repairs overlapping Institute openings saved by the older edge projection", () => {
    const { world } = buildWorld(1884);
    const institute = world.buildings.find((venue) => venue.kind === "research")!;
    const top = institute.center.z - institute.size.z / 2;
    const walls: Wall[] = [
      { id: 1, a: { x: 6, z: top }, b: { x: 9.604, z: top }, buildingId: institute.regionId },
      { id: 2, a: { x: 13.956, z: top }, b: { x: 12.8, z: top }, buildingId: institute.regionId },
      { id: 3, a: { x: 17.2, z: top }, b: { x: 16.044, z: top }, buildingId: institute.regionId },
      { id: 4, a: { x: 20.396, z: top }, b: { x: 24, z: top }, buildingId: institute.regionId }
    ];
    const portals: Portal[] = [
      { id: 1, a: { x: 12.8, z: top }, b: { x: 17.2, z: top }, regionA: 0, regionB: institute.regionId },
      { id: 90, a: { x: 9.604, z: top }, b: { x: 13.956, z: top }, regionA: 0, regionB: institute.regionId },
      { id: 91, a: { x: 16.044, z: top }, b: { x: 20.396, z: top }, regionA: 0, regionB: institute.regionId }
    ];

    const repaired = repairBoundaryTopology(walls, portals, [institute]);

    expect(repaired.changed).toBe(true);
    expect(repaired.portals).toHaveLength(1);
    expect(interval(repaired.portals[0])[0]).toBeCloseTo(9.604);
    expect(interval(repaired.portals[0])[1]).toBeCloseTo(20.396);
    expect(repaired.walls.map(interval)).toEqual([[6, 9.604], [20.396, 24]]);
  });
});
