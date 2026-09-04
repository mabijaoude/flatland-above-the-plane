import type { CameraMode } from "../types";

export type DesktopCitizenInputMode = "directional" | "steering";

/**
 * Chase and overhead controls are camera-relative so every WASD key produces
 * immediate movement. Native vision keeps resident-relative steering because
 * the camera is the citizen's point of view there.
 */
export function desktopCitizenInputMode(camera: CameraMode): DesktopCitizenInputMode {
  return camera === "native" ? "steering" : "directional";
}
