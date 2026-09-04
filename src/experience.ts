import type { CameraMode, ExperienceMode, QualityPreference } from "./types";

export type InterventionTool = "none" | "carry" | "reinsert" | "cut" | "seal";
export type AppOverlay =
  | "none"
  | "people"
  | "town"
  | "gazette"
  | "book"
  | "about"
  | "help"
  | "confirm-recall"
  | "confirm-reset"
  | "confirm-new-town"
  | "confirm-carry-exit";

export type GuidedTourStep =
  | "idle"
  | "survey"
  | "people"
  | "follow"
  | "native"
  | "plane-preview"
  | "undo"
  | "complete";

export type ExperienceActivity =
  | {
      kind: "explore";
      camera: "survey" | "framed" | "follow" | "native";
      followedResidentId: number | null;
      tool?: "carry" | "reinsert";
    }
  | { kind: "join"; panel: "choose" | "create" }
  | {
      kind: "embodied";
      residentId: number;
      camera: "chase" | "overhead" | "native";
      tool: "none" | "carry" | "reinsert";
      returnTo: "survey" | "follow";
    }
  | { kind: "intervene"; tool: InterventionTool };

export type ExperienceState = {
  activity: ExperienceActivity;
  projection: "perspective" | "orthographic";
  selectedResidentId: number | null;
  lastControlledResidentId: number | null;
  playerResidentIds: number[];
  introActive: boolean;
  quality: QualityPreference;
  overlay: AppOverlay;
  tourStep: GuidedTourStep;
};

export const initialExperienceState: ExperienceState = {
  activity: { kind: "explore", camera: "survey", followedResidentId: null },
  projection: "perspective",
  selectedResidentId: null,
  lastControlledResidentId: null,
  playerResidentIds: [],
  introActive: true,
  quality: "auto",
  overlay: "none",
  tourStep: "idle"
};

export function experienceMode(state: ExperienceState): ExperienceMode {
  if (state.activity.kind === "intervene") return "intervene";
  if (state.activity.kind === "join" || state.activity.kind === "embodied") return "join";
  return "explore";
}

export function cameraMode(state: ExperienceState): CameraMode {
  if (state.activity.kind === "embodied") return state.activity.camera;
  if (state.activity.kind === "explore") return state.activity.camera;
  return "survey";
}

export function controlledResidentId(state: ExperienceState) {
  return state.activity.kind === "embodied" ? state.activity.residentId : null;
}

export function followedResidentId(state: ExperienceState) {
  return state.activity.kind === "explore" ? state.activity.followedResidentId : null;
}

export function joinPanel(state: ExperienceState) {
  return state.activity.kind === "join" ? state.activity.panel : "closed" as const;
}

export function interventionTool(state: ExperienceState) {
  return state.activity.kind === "intervene" || state.activity.kind === "embodied"
    ? state.activity.tool
    : state.activity.kind === "explore"
      ? state.activity.tool ?? "none"
      : "none";
}

export type PrimaryNavigationSection = "survey" | "people" | "plane";

export function primaryNavigationSection(state: ExperienceState): PrimaryNavigationSection {
  if (state.overlay === "people") return "people";
  if (state.activity.kind === "intervene") return "plane";
  if (
    state.activity.kind === "join"
    || state.activity.kind === "embodied"
    || (state.activity.kind === "explore" && state.activity.followedResidentId !== null)
    || state.selectedResidentId !== null
  ) return "people";
  return "survey";
}

export type ExperienceAction =
  | { type: "select"; residentId: number | null }
  | { type: "set-mode"; mode: ExperienceMode }
  | { type: "close-join" }
  | { type: "open-creator" }
  | { type: "follow"; residentId: number }
  | { type: "stop-follow" }
  | { type: "begin-control"; residentId: number; returnTo?: "survey" | "follow" }
  | { type: "end-control"; to?: "survey" | "follow" }
  | { type: "set-camera"; cameraMode: CameraMode }
  | { type: "set-projection"; projection: "perspective" | "orthographic" }
  | { type: "frame-town" }
  | { type: "set-tool"; tool: InterventionTool }
  | { type: "created"; residentId: number }
  | { type: "cancel-intro" }
  | { type: "set-quality"; quality: QualityPreference }
  | { type: "set-overlay"; overlay: AppOverlay }
  | { type: "set-tour-step"; step: GuidedTourStep }
  | { type: "start-tour" }
  | { type: "cancel-tour" }
  | { type: "back" }
  | {
      type: "restore-session";
      state: {
        mode: ExperienceMode;
        cameraMode: CameraMode;
        selectedResidentId: number | null;
        followedResidentId: number | null;
        lastControlledResidentId: number | null;
        playerResidentIds: number[];
        projection: "perspective" | "orthographic";
        quality: QualityPreference;
      };
    };

export function experienceReducer(state: ExperienceState, action: ExperienceAction): ExperienceState {
  switch (action.type) {
    case "select":
      return { ...state, selectedResidentId: action.residentId };
    case "set-mode": {
      if (action.mode === "explore") {
        const followed = state.activity.kind === "embodied" ? state.activity.residentId : null;
        return {
          ...state,
          activity: followed === null
            ? { kind: "explore", camera: "survey", followedResidentId: null }
            : { kind: "explore", camera: "follow", followedResidentId: followed },
          projection: "perspective",
          introActive: false,
          overlay: "none"
        };
      }
      if (action.mode === "join") {
        if (state.activity.kind === "embodied") return state;
        return { ...state, activity: { kind: "join", panel: "choose" }, projection: "perspective", introActive: false, overlay: "none" };
      }
      return { ...state, activity: { kind: "intervene", tool: "none" }, projection: "perspective", introActive: false, overlay: "none" };
    }
    case "close-join":
      return state.activity.kind === "join"
        ? { ...state, activity: { kind: "explore", camera: "survey", followedResidentId: null } }
        : state;
    case "open-creator":
      return { ...state, activity: { kind: "join", panel: "create" }, introActive: false, overlay: "none" };
    case "follow":
      return {
        ...state,
        activity: { kind: "explore", camera: "follow", followedResidentId: action.residentId },
        projection: "perspective",
        selectedResidentId: action.residentId,
        introActive: false,
        overlay: "none"
      };
    case "stop-follow":
      return state.activity.kind === "explore"
        ? { ...state, activity: { ...state.activity, camera: "survey", followedResidentId: null }, introActive: false }
        : state;
    case "begin-control":
      return {
        ...state,
        activity: {
          kind: "embodied",
          residentId: action.residentId,
          camera: "chase",
          tool: "none",
          returnTo: action.returnTo
            ?? (state.activity.kind === "explore" && state.activity.followedResidentId === action.residentId ? "follow" : "survey")
        },
        projection: "perspective",
        selectedResidentId: action.residentId,
        lastControlledResidentId: action.residentId,
        introActive: false,
        overlay: "none"
      };
    case "end-control":
      return state.activity.kind === "embodied"
        ? {
            ...state,
            activity: (action.to ?? state.activity.returnTo) === "follow"
              ? { kind: "explore", camera: "follow", followedResidentId: state.activity.residentId }
              : { kind: "explore", camera: "survey", followedResidentId: null },
            projection: "perspective",
            overlay: "none"
          }
        : state;
    case "set-camera": {
      if (state.activity.kind === "embodied" && ["chase", "overhead", "native"].includes(action.cameraMode)) {
        return { ...state, activity: { ...state.activity, camera: action.cameraMode as "chase" | "overhead" | "native" }, introActive: false };
      }
      if (state.activity.kind === "explore" && ["survey", "framed", "follow", "native"].includes(action.cameraMode)) {
        if (action.cameraMode === "native" && state.activity.followedResidentId === null) return state;
        const followed = action.cameraMode === "follow" || action.cameraMode === "native" ? state.activity.followedResidentId : null;
        return {
          ...state,
          activity: {
            ...state.activity,
            camera: action.cameraMode as "survey" | "framed" | "follow" | "native",
            followedResidentId: followed
          },
          introActive: false
        };
      }
      return state;
    }
    case "set-projection":
      return state.activity.kind === "explore" ? { ...state, projection: action.projection, introActive: false } : state;
    case "frame-town":
      return state.activity.kind === "explore"
        ? { ...state, activity: { ...state.activity, camera: "framed", followedResidentId: null }, projection: "orthographic", introActive: false }
        : state;
    case "set-tool":
      if (state.activity.kind === "intervene") return { ...state, activity: { kind: "intervene", tool: action.tool } };
      if (state.activity.kind === "embodied" && ["none", "carry", "reinsert"].includes(action.tool)) {
        return { ...state, activity: { ...state.activity, tool: action.tool as "none" | "carry" | "reinsert" } };
      }
      if (state.activity.kind === "explore" && ["none", "carry", "reinsert"].includes(action.tool)) {
        return {
          ...state,
          activity: {
            ...state.activity,
            tool: action.tool === "none" ? undefined : action.tool as "carry" | "reinsert"
          }
        };
      }
      return state;
    case "created":
      return {
        ...state,
        activity: { kind: "join", panel: "choose" },
        projection: "perspective",
        selectedResidentId: action.residentId,
        lastControlledResidentId: action.residentId,
        playerResidentIds: state.playerResidentIds.includes(action.residentId) ? state.playerResidentIds : [...state.playerResidentIds, action.residentId],
        overlay: "none"
      };
    case "cancel-intro":
      return state.introActive
        ? { ...state, introActive: false, activity: { kind: "explore", camera: "survey", followedResidentId: null } }
        : state;
    case "set-quality":
      return { ...state, quality: action.quality };
    case "set-overlay":
      return { ...state, overlay: action.overlay };
    case "set-tour-step":
      return { ...state, tourStep: action.step };
    case "start-tour":
      return {
        ...state,
        introActive: false,
        overlay: "none",
        tourStep: "survey",
        activity: { kind: "explore", camera: "survey", followedResidentId: null },
        projection: "perspective",
        selectedResidentId: null
      };
    case "cancel-tour":
      return {
        ...state,
        overlay: "none",
        tourStep: "idle",
        activity: { kind: "explore", camera: "survey", followedResidentId: null },
        projection: "perspective",
        selectedResidentId: null
      };
    case "back": {
      if (state.overlay !== "none") return { ...state, overlay: "none" };
      if (state.activity.kind === "intervene") {
        if (state.activity.tool !== "none") return { ...state, activity: { ...state.activity, tool: "none" } };
        return { ...state, activity: { kind: "explore", camera: "survey", followedResidentId: null }, selectedResidentId: null };
      }
      if (state.activity.kind === "join") {
        return { ...state, activity: { kind: "explore", camera: "survey", followedResidentId: null }, selectedResidentId: null };
      }
      if (state.activity.kind === "embodied") {
        if (state.activity.tool === "reinsert") {
          return { ...state, activity: { ...state.activity, tool: "carry" } };
        }
        if (state.activity.tool === "carry") {
          return { ...state, overlay: "confirm-carry-exit" };
        }
        return {
          ...state,
          activity: state.activity.returnTo === "follow"
            ? { kind: "explore", camera: "follow", followedResidentId: state.activity.residentId }
            : { kind: "explore", camera: "survey", followedResidentId: null },
          projection: "perspective"
        };
      }
      if (state.activity.tool === "reinsert") {
        return { ...state, activity: { ...state.activity, tool: "carry" } };
      }
      if (state.activity.tool === "carry") {
        return { ...state, overlay: "confirm-carry-exit" };
      }
      if (state.activity.camera === "native") {
        return { ...state, activity: { ...state.activity, camera: "follow" } };
      }
      if (state.activity.camera === "follow" || state.activity.camera === "framed") {
        return {
          ...state,
          activity: { kind: "explore", camera: "survey", followedResidentId: null },
          projection: "perspective",
          selectedResidentId: state.activity.camera === "follow" ? state.selectedResidentId : null
        };
      }
      if (state.selectedResidentId !== null) return { ...state, selectedResidentId: null };
      return state;
    }
    case "restore-session": {
      const restoredActivity: ExperienceActivity = action.state.cameraMode === "follow" && action.state.followedResidentId !== null
        ? { kind: "explore", camera: "follow", followedResidentId: action.state.followedResidentId }
        : action.state.cameraMode === "framed"
          ? { kind: "explore", camera: "framed", followedResidentId: null }
          : action.state.mode === "intervene"
            ? { kind: "intervene", tool: "none" }
            : action.state.mode === "join"
              ? { kind: "join", panel: "choose" }
              : { kind: "explore", camera: "survey", followedResidentId: null };
      return {
        ...state,
        activity: restoredActivity,
        projection: restoredActivity.kind === "explore" ? action.state.projection : "perspective",
        selectedResidentId: action.state.selectedResidentId,
        lastControlledResidentId: action.state.lastControlledResidentId,
        playerResidentIds: action.state.playerResidentIds,
        quality: action.state.quality,
        introActive: false,
        overlay: "none",
        tourStep: "idle"
      };
    }
  }
}
