import { describe, expect, it } from "vitest";
import { distanceToSegment, raySegmentDistance, wallCollision } from "./geometry";

describe("plane geometry", () => {
  const wall = { id: 1, buildingId: 1, a: { x: 0, z: -5 }, b: { x: 0, z: 5 } };

  it("measures residents against line boundaries", () => {
    expect(distanceToSegment({ x: 3, z: 2 }, wall.a, wall.b)).toBeCloseTo(3);
    expect(wallCollision({ x: 0.4, z: 0 }, 0.8, [wall])).toBe(true);
    expect(wallCollision({ x: 2, z: 0 }, 0.8, [wall])).toBe(false);
  });

  it("finds the first boundary visible along a ray", () => {
    expect(raySegmentDistance({ x: -4, z: 0 }, { x: 1, z: 0 }, wall, 20)).toBeCloseTo(4);
  });
});

