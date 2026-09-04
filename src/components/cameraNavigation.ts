export type CameraBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export const SURVEY_CAMERA_POSITION = { x: 0, y: 120, z: 78 } as const;
export const SURVEY_MIN_POLAR_DEGREES = 20;
export const SURVEY_MAX_POLAR_DEGREES = 60;
export const SURVEY_MIN_DISTANCE = 12;
export const SURVEY_MAX_DISTANCE = 260;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function clampSurveyTarget(bounds: CameraBounds, target: { x: number; z: number }) {
  const width = Math.max(0, bounds.maxX - bounds.minX);
  const depth = Math.max(0, bounds.maxZ - bounds.minZ);
  const insetX = Math.min(12, width * 0.2);
  const insetZ = Math.min(10, depth * 0.2);
  return {
    x: clamp(target.x, bounds.minX + insetX, bounds.maxX - insetX),
    z: clamp(target.z, bounds.minZ + insetZ, bounds.maxZ - insetZ)
  };
}
