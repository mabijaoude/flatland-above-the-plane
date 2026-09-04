import type { SurfaceKind } from "../types";

export type SurfaceSlab = {
  centerY: number;
  height: number;
  topY: number;
  bottomY: number;
};

/**
 * The visible surfaces are thin, stacked sheets rather than intersecting boxes.
 * Keeping every upper sheet's underside above the sheet below prevents both
 * depth flicker and the need for a foreground polygon offset.
 */
export function surfaceSlab(kind: SurfaceKind, layer: number): SurfaceSlab {
  let topY: number;
  let height: number;

  if (kind === "plane") {
    topY = -0.0015;
    height = 0.025;
  } else if (kind === "road") {
    topY = 0.014 + layer * 0.0012;
    height = 0.0008;
  } else if (kind === "building") {
    topY = 0.035 + layer * 0.00005;
    height = 0.006;
  } else {
    topY = 0.026 + layer * 0.0001;
    height = 0.004;
  }

  return {
    centerY: topY - height / 2,
    height,
    topY,
    bottomY: topY - height
  };
}

export const RESIDENT_OUTLINE_CENTER_Y = 0.052;
export const RESIDENT_FILL_CENTER_Y = 0.068;
export const RESIDENT_OUTLINE_HEIGHT = 0.025;
export const RESIDENT_FILL_HEIGHT = 0.03;

