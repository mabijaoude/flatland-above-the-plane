export type Vec2 = { x: number; z: number };

export type ResidentMotionState =
  | "idle"
  | "moving"
  | "waiting-capacity"
  | "waiting-portal"
  | "blocked"
  | "arrived"
  | "controlled";

export type Wall = {
  id: number;
  a: Vec2;
  b: Vec2;
  buildingId: number;
  heritage?: boolean;
  materialId?: string;
  reopens?: {
    regionA: number;
    regionB: number;
    sourceWallId?: number;
  };
};

export type Portal = {
  id: number;
  a: Vec2;
  b: Vec2;
  regionA: number;
  regionB: number;
  sourceWallId?: number;
};

export type SurfaceKind = "plane" | "road" | "square" | "building" | "garden" | "court";

export type Surface = {
  id: string;
  center: Vec2;
  size: Vec2;
  kind: SurfaceKind;
  materialId: string;
  color: string;
  pathWeight: number;
};

export type VenueKind =
  | "home"
  | "grocery"
  | "restaurant"
  | "printworks"
  | "school"
  | "clinic"
  | "civic"
  | "archive"
  | "research"
  | "sealed-room";

export type AnchorKind = "home" | "staff" | "visitor" | "queue";

export type ActivityAnchor = {
  id: string;
  kind: AnchorKind;
  position: Vec2;
  facing: number;
};

export type EntranceMetadata = {
  portalId: number | null;
  center: Vec2;
  outwardNormal: Vec2;
  tangent: Vec2;
  outsideStage: Vec2;
  insideStage: Vec2;
  corridorHalfWidth: number;
  queueSlots: Vec2[];
};

export type Venue = {
  id: number;
  regionId: number;
  name: string;
  shortName: string;
  kind: VenueKind;
  district: "residential" | "market" | "services" | "works" | "dimensional";
  center: Vec2;
  size: Vec2;
  doorSide: "north" | "south" | "east" | "west";
  materialId: string;
  entrancePortalIds: number[];
  entrance: EntranceMetadata;
  anchors: ActivityAnchor[];
  staffCapacity: number;
  visitorCapacity: number;
  openMinute: number;
  closeMinute: number;
  sealed?: boolean;
};

export type PublicPlace = {
  id: "abbott-square" | "east-garden" | "west-common";
  name: string;
  center: Vec2;
  size: Vec2;
  capacity: number;
  anchors: ActivityAnchor[];
};

export type WorldStatic = {
  seed: number;
  generatorVersion: 3;
  topologyVersion: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  walls: Wall[];
  portals: Portal[];
  surfaces: Surface[];
  buildings: Venue[];
  publicPlaces: PublicPlace[];
  sealedRoomId: number;
  groceryId: number;
  restaurantId: number;
  printworksId: number;
  cartouche: {
    title: "FLATLAND";
    subtitle: "A ROMANCE OF MANY DIMENSIONS";
    author: "EDWIN A. ABBOTT";
    publication: "FIRST PUBLISHED 1884";
  };
};

export type ScheduleTemplate = "early-service" | "day-worker" | "civic-split" | "restaurant" | "route-worker";

export type ResidentStatic = {
  id: number;
  name: string;
  sides: 3 | 4 | 5 | 6 | 8 | 12;
  radius: number;
  color: string;
  rim: "plain" | "double" | "notched";
  homeBuildingId: number;
  workplaceId: number;
  homeSlot: number;
  workSlot: number;
  role: string;
  scheduleTemplate: ScheduleTemplate;
};

export enum DimensionalState {
  OnPlane = 0,
  BeingLifted = 1,
  OffPlane = 2,
  BeingReinserted = 3
}

export const ACTIONS = [
  "Travel",
  "Queue",
  "Work",
  "Shop",
  "Dine",
  "Socialize",
  "Leisure",
  "RestAtHome",
  "PlayerControlled",
  "Stranded"
] as const;
export type ResidentAction = typeof ACTIONS[number];

export type GoalKind = "home" | "work" | "meal" | "errand" | "leisure" | "delivery" | "seek-exit";
export type ControllerKind = "ai" | "player";

export type ResidentNeeds = {
  rest: number;
  nourishment: number;
  belonging: number;
  purpose: number;
};

export type ResidentMemory = {
  type: string;
  tick: number;
  position: Vec2;
  confidence: number;
};

export type ResidentTelemetry = {
  residentId: number;
  action: ResidentAction;
  goal: GoalKind;
  destinationBuildingId: number | null;
  destinationName: string;
  intent: string;
  controller: ControllerKind;
  routeStatus: "idle" | "routing" | "arrived" | "blocked";
  motionState: ResidentMotionState;
  routeProgress: number;
  waitSeconds: number;
  blockedReason: string | null;
  waitingForResidentId: number | null;
  waitingVenueId: number | null;
  velocity: Vec2;
  needs: ResidentNeeds;
};

export type RenderSnapshot = {
  tick: number;
  timeMinutes: number;
  day: number;
  stride: number;
  residentCount: number;
  data: Float32Array;
  telemetry: ResidentTelemetry[];
};

export type SimEvent = {
  id: number;
  tick: number;
  day?: number;
  timeMinutes?: number;
  type: "world" | "activity" | "arrival" | "encounter" | "dimensional" | "intervention" | "route";
  summary: string;
  actors: number[];
  position?: Vec2;
  venueId?: number;
};

export type ResidentProfile = {
  name: string;
  sides: 3 | 4 | 5 | 6 | 8 | 12;
  color: string;
  rim: ResidentStatic["rim"];
};

export type SavedResidentV2 = ResidentStatic & {
  position: Vec2;
  rotation: number;
  altitude: number;
  dimensionalState: DimensionalState;
  action: ResidentAction;
  goal: GoalKind;
  destinationBuildingId: number | null;
  destinationAnchorId: string | null;
  dwellUntilMinute: number;
  controller: ControllerKind;
  needs: ResidentNeeds;
  institutionalStatus: number;
  higherDimensionBelief: number;
  memories: ResidentMemory[];
};

export type WorldSaveV2 = {
  version: 2;
  generatorVersion: 2;
  seed: number;
  tick: number;
  timeMinutes: number;
  day: number;
  topologyVersion: number;
  walls: Wall[];
  portals: Portal[];
  residents: SavedResidentV2[];
  events: SimEvent[];
};

export type WorldSaveV3 = {
  version: 3;
  generatorVersion: 3;
  seed: number;
  tick: number;
  timeMinutes: number;
  day: number;
  topologyVersion: number;
  walls: Wall[];
  portals: Portal[];
  residents: SavedResidentV2[];
  events: SimEvent[];
};

export type CameraPoseSave = {
  position: [number, number, number];
  target: [number, number, number];
  projection: "perspective" | "orthographic";
};

export type ExperienceMode = "explore" | "join" | "intervene";
export type CameraMode = "survey" | "follow" | "chase" | "overhead" | "native" | "framed";

export type SessionSaveV2 = {
  mode: ExperienceMode;
  cameraMode: CameraMode;
  selectedResidentId: number | null;
  followedResidentId: number | null;
  lastControlledResidentId: number | null;
  playerResidentIds: number[];
  cameraPose?: CameraPoseSave;
  quality: QualityPreference;
};

export type FlatworldSaveV2 = {
  version: 2;
  savedAt: string;
  simulation: WorldSaveV2;
  session: SessionSaveV2;
};

export type SessionSaveV3 = {
  mode: "explore" | "join" | "intervene";
  cameraMode: "survey" | "follow" | "framed";
  selectedResidentId: number | null;
  followedResidentId: number | null;
  lastControlledResidentId: number | null;
  playerResidentIds: number[];
  cameraPose?: CameraPoseSave;
  quality: QualityPreference;
};

export type FlatworldSaveV3 = {
  version: 3;
  savedAt: string;
  simulation: WorldSaveV3;
  session: SessionSaveV3;
};

export type ResidentControlIntent = {
  residentId: number;
  move: Vec2;
  sprint: boolean;
  sequence: number;
  sentAt: number;
};

export type ResidentSteeringIntent = {
  residentId: number;
  forward: number;
  turn: number;
  sprint: boolean;
  sequence: number;
  sentAt: number;
};

export type SimCommand =
  | { type: "initialize"; seed: number }
  | { type: "begin-resident-control"; residentId: number; requestId: number }
  | ({ type: "set-resident-input" } & ResidentControlIntent)
  | ({ type: "set-resident-steering" } & ResidentSteeringIntent)
  | { type: "end-resident-control"; residentId: number; resumeRoutine: true; requestId: number }
  | { type: "recover-resident"; residentId: number }
  | { type: "create-resident"; profile: ResidentProfile; requestId: number }
  | { type: "lift"; residentId: number }
  | { type: "move-lifted"; residentId: number; target: Vec2; altitude?: number }
  | { type: "rotate-lifted"; residentId: number; radians: number }
  | { type: "drop"; residentId: number; target?: Vec2; reducedMotion?: boolean }
  | { type: "reinsert"; residentId: number; target: Vec2 }
  | { type: "cut-at"; target: Vec2 }
  | { type: "seal-at"; target: Vec2 }
  | { type: "reset-plane" }
  | { type: "undo-intervention" }
  | { type: "set-clock"; paused?: boolean; timeScale?: number }
  | { type: "request-save"; requestId: number }
  | { type: "load-save"; save: WorldSaveV2 | WorldSaveV3 };

export type WorkerMessage =
  | { type: "ready"; world: WorldStatic; residents: ResidentStatic[]; events: SimEvent[] }
  | { type: "snapshot"; tick: number; timeMinutes: number; day: number; stride: number; residentCount: number; telemetry: ResidentTelemetry[]; buffer: ArrayBuffer }
  | { type: "world-changed"; world: WorldStatic }
  | { type: "residents-changed"; residents: ResidentStatic[] }
  | { type: "events"; events: SimEvent[] }
  | { type: "save-result"; requestId: number; save: WorldSaveV3 }
  | { type: "command-result"; ok: boolean; command: SimCommand["type"]; message: string; residentId?: number; requestId?: number };

export type QualityPreference = "auto" | "cinematic" | "balanced" | "lite";
