import type { InterventionTool } from "../experience";
import type { ExperienceMode } from "../types";

export type GroundInteractionIntent = "select" | "place" | "edit-boundary" | "none";

export function groundInteractionIntent(mode: ExperienceMode, tool: InterventionTool): GroundInteractionIntent {
  if (tool === "reinsert") return "place";
  if (mode === "intervene" && tool !== "carry") return "edit-boundary";
  if (mode === "explore") return "select";
  return "none";
}
