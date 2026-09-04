import { describe, expect, it } from "vitest";
import { clampSurveyTarget } from "./cameraNavigation";

describe("desktop survey camera policy", () => {
  it("keeps mouse panning focused inside the useful town bounds", () => {
    const bounds = { minX: -68, maxX: 68, minZ: -52, maxZ: 52 };

    expect(clampSurveyTarget(bounds, { x: -400, z: 300 })).toEqual({ x: -56, z: 42 });
    expect(clampSurveyTarget(bounds, { x: 14, z: -18 })).toEqual({ x: 14, z: -18 });
  });

});
