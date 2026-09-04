import { describe, expect, it } from "vitest";
import type { Portal, Wall } from "../types";
import { resolveBoundaryEditCandidate } from "./boundaryEditing";

const wall: Wall = {
  id: 1,
  a: { x: 0, z: 0 },
  b: { x: 10, z: 0 },
  buildingId: 1
};

const portal: Portal = {
  id: 2,
  a: { x: 3, z: 0 },
  b: { x: 7, z: 0 },
  regionA: 0,
  regionB: 1
};

describe("resolveBoundaryEditCandidate", () => {
  it("turns a nearby wall into a red remove action at the intended opening", () => {
    const candidate = resolveBoundaryEditCandidate({ walls: [wall], portals: [] }, { x: 5, z: 1 });

    expect(candidate).toMatchObject({ id: "wall-1", action: "cut", point: { x: 5, z: 0 } });
    expect(candidate?.a.x).toBeCloseTo(2.8);
    expect(candidate?.b.x).toBeCloseTo(7.2);
  });

  it("keeps an edge preview inside the wall when the tap lands at an endpoint", () => {
    const candidate = resolveBoundaryEditCandidate({ walls: [wall], portals: [] }, { x: 10, z: 0 });

    expect(candidate?.action).toBe("cut");
    expect(candidate?.a.x).toBeCloseTo(5.6);
    expect(candidate?.b.x).toBeCloseTo(10);
  });

  it("absorbs tiny wall remnants instead of previewing narrow teeth", () => {
    const shortFrontage = { ...wall, b: { x: 6.8, z: 0 } };
    const candidate = resolveBoundaryEditCandidate({ walls: [shortFrontage], portals: [] }, { x: 3.4, z: 0 });

    expect(candidate?.a).toEqual(shortFrontage.a);
    expect(candidate?.b).toEqual(shortFrontage.b);
  });

  it("turns a nearby opening into a green add action", () => {
    const candidate = resolveBoundaryEditCandidate({ walls: [], portals: [portal] }, { x: 4, z: 1 });

    expect(candidate).toEqual({
      id: "portal-2",
      action: "seal",
      point: { x: 5, z: 0 },
      a: portal.a,
      b: portal.b
    });
  });

  it("prefers an opening where it meets an adjacent wall", () => {
    const candidate = resolveBoundaryEditCandidate({ walls: [wall], portals: [portal] }, { x: 3, z: 0 });

    expect(candidate?.action).toBe("seal");
  });

  it("does not offer impossible cuts on short wall fragments", () => {
    const shortWall = { ...wall, b: { x: 4, z: 0 } };

    expect(resolveBoundaryEditCandidate({ walls: [shortWall], portals: [] }, { x: 2, z: 0 })).toBeUndefined();
  });

  it("still lets a short wall that sealed a doorway be removed", () => {
    const sealedOpening = { ...wall, b: { x: 4, z: 0 }, reopens: { regionA: 0, regionB: 1 } };
    const candidate = resolveBoundaryEditCandidate({ walls: [sealedOpening], portals: [] }, { x: 2, z: 0 });

    expect(candidate?.action).toBe("cut");
    expect(candidate?.a).toEqual(sealedOpening.a);
    expect(candidate?.b).toEqual(sealedOpening.b);
  });

  it("returns no action away from editable edges", () => {
    expect(resolveBoundaryEditCandidate({ walls: [wall], portals: [portal] }, { x: 5, z: 12 }, 3)).toBeUndefined();
  });
});
