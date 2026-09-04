import type { LoadedWorld } from "./persistence";

export const WELCOME_STORAGE_KEY = "flatworld-welcome-v1";

export type StartupDestination = "welcome" | "resume" | "fresh";

export function chooseStartupDestination(
  welcomeSeen: boolean,
  loaded: LoadedWorld | undefined
): StartupDestination {
  if (!welcomeSeen) return "welcome";
  if (loaded && loaded.kind !== "legacy") return "resume";
  return "fresh";
}

