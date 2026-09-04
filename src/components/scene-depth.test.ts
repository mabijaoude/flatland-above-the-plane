import { describe, expect, it } from "vitest";
import { buildWorld } from "../simulation/world";
import {
  RESIDENT_OUTLINE_CENTER_Y,
  RESIDENT_OUTLINE_HEIGHT,
  surfaceSlab
} from "./sceneDepth";

function overlaps(first: { center: { x: number; z: number }; size: { x: number; z: number } }, second: { center: { x: number; z: number }; size: { x: number; z: number } }) {
  return Math.abs(first.center.x - second.center.x) < (first.size.x + second.size.x) / 2
    && Math.abs(first.center.z - second.center.z) < (first.size.z + second.size.z) / 2;
}

describe("scene depth layers", () => {
  it("keeps public-place slabs physically above every road they cover", () => {
    const surfaces = buildWorld(1884).world.surfaces;
    const roads = surfaces.map((surface, layer) => ({ surface, layer })).filter(({ surface }) => surface.kind === "road");
    const publicPlaces = surfaces.map((surface, layer) => ({ surface, layer })).filter(({ surface }) => ["square", "garden", "court"].includes(surface.kind));

    for (const place of publicPlaces) {
      const placeSlab = surfaceSlab(place.surface.kind, place.layer);
      for (const road of roads.filter(({ surface }) => overlaps(place.surface, surface))) {
        expect(placeSlab.bottomY, `${place.surface.id} should clear ${road.surface.id}`).toBeGreaterThan(surfaceSlab("road", road.layer).topY);
      }
    }
  });

  it("keeps citizen outlines above the highest walkable sheet", () => {
    const surfaces = buildWorld(1884).world.surfaces;
    const highestSurface = Math.max(...surfaces.map((surface, layer) => surfaceSlab(surface.kind, layer).topY));
    const outlineBottom = RESIDENT_OUTLINE_CENTER_Y - RESIDENT_OUTLINE_HEIGHT / 2;

    expect(outlineBottom).toBeGreaterThan(highestSurface);
  });
});

