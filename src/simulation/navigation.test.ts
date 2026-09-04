import { describe, expect, it } from "vitest";
import { findPath, lineClear } from "./navigation";
import { buildWorld } from "./world";

describe("purposeful town navigation", () => {
  it("finds wall-safe routes from every initial position to work", () => {
    const { world, residents, spawnPoints } = buildWorld(1884);
    for (const resident of residents) {
      const workplace = world.buildings.find((venue) => venue.id === resident.workplaceId)!;
      const anchor = workplace.anchors.filter((candidate) => candidate.kind === "staff")[resident.workSlot];
      expect(anchor, `${resident.name} needs a staff position`).toBeDefined();
      const path = findPath(world, spawnPoints[resident.id], anchor.position, resident.radius);
      expect(path.length, `${resident.name} needs a route to ${workplace.name}`).toBeGreaterThan(0);
      let cursor = spawnPoints[resident.id];
      for (const waypoint of path) {
        expect(lineClear(world, cursor, waypoint, resident.radius), `${resident.name}'s route crossed a boundary`).toBe(true);
        cursor = waypoint;
      }
    }
  });
});
