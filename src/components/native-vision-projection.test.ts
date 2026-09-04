import { describe, expect, it } from "vitest";
import {
  NATIVE_VISION_FIELD_OF_VIEW,
  projectNativeVisionBodies,
  regularPolygonVertices,
  type NativeVisionBody
} from "./nativeVisionProjection";

const rayCount = 721;
const openView = new Float32Array(rayCount).fill(100);

function body(overrides: Partial<NativeVisionBody> = {}): NativeVisionBody {
  return {
    id: 1,
    center: { x: 0, z: 4 },
    rotation: 0,
    sides: 8,
    radius: 1,
    ...overrides
  };
}

function project(bodies: NativeVisionBody[], occluderDistances: ArrayLike<number> = openView) {
  return projectNativeVisionBodies({
    origin: { x: 0, z: 0 },
    viewRotation: 0,
    rayCount,
    bodies,
    occluderDistances
  });
}

function visibleRayCount(hits: ReturnType<typeof project>, bodyId = 1) {
  return hits.filter((hit) => hit?.bodyId === bodyId).length;
}

describe("native vision polygon projection", () => {
  it("constructs the same regular polygon footprint used by the town renderer", () => {
    const vertices = regularPolygonVertices(body({ center: { x: 2, z: 3 }, sides: 4, radius: 2 }));

    expect(vertices).toHaveLength(4);
    expect(vertices[0]).toEqual({ x: 2, z: 5 });
    expect(vertices[1].x).toBeCloseTo(4);
    expect(vertices[1].z).toBeCloseTo(3);
  });

  it("gives a nearby octagon its true apparent angular width instead of one thin line", () => {
    const hits = project([body()]);
    const span = visibleRayCount(hits);
    const expectedCircularSpan = 2 * Math.asin(1 / 4) / NATIVE_VISION_FIELD_OF_VIEW * rayCount;

    expect(span).toBeGreaterThan(expectedCircularSpan * 0.82);
    expect(span).toBeLessThan(expectedCircularSpan * 1.03);
    expect(span).toBeGreaterThan(90);
  });

  it("makes the same citizen narrower with distance", () => {
    const nearbySpan = visibleRayCount(project([body({ center: { x: 0, z: 4 } })]));
    const distantSpan = visibleRayCount(project([body({ center: { x: 0, z: 12 } })]));

    expect(nearbySpan).toBeGreaterThan(distantSpan * 2.5);
  });

  it("lets walls hide all or only part of a citizen ray by ray", () => {
    const fullyBlocked = new Float32Array(rayCount).fill(2);
    expect(visibleRayCount(project([body()], fullyBlocked))).toBe(0);

    const partlyBlocked = new Float32Array(openView);
    for (let index = Math.floor(rayCount * 0.5); index < rayCount; index += 1) partlyBlocked[index] = 2;
    const partialSpan = visibleRayCount(project([body()], partlyBlocked));
    const openSpan = visibleRayCount(project([body()]));
    expect(partialSpan).toBeGreaterThan(0);
    expect(partialSpan).toBeLessThan(openSpan);
  });

  it("shows the nearer polygon where citizens overlap in the visual field", () => {
    const hits = project([
      body({ id: 1, center: { x: 0, z: 8 } }),
      body({ id: 2, center: { x: 0, z: 4 } })
    ]);
    const centreHit = hits[Math.floor(rayCount / 2)];

    expect(centreHit?.bodyId).toBe(2);
    expect(centreHit?.distance).toBeLessThan(4);
  });
});
