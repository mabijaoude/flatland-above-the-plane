import {
  ACTIONS,
  DimensionalState,
  type ActivityAnchor,
  type ControllerKind,
  type GoalKind,
  type RenderSnapshot,
  type ResidentAction,
  type ResidentNeeds,
  type ResidentProfile,
  type ResidentStatic,
  type ResidentMotionState,
  type ResidentTelemetry,
  type SavedResidentV2,
  type SimEvent,
  type Vec2,
  type Venue,
  type WorldSaveV2,
  type WorldSaveV3,
  type WorldStatic
} from "../types";
import { distanceToSegment, nearestWall, wallCollision } from "./geometry";
import { findPath } from "./navigation";
import { createOpeningAt, EDITABLE_OPENING_WIDTH, repairBoundaryTopology } from "./topology";
import { buildWorld } from "./world";

type InputState = {
  mode: "world" | "steering";
  move: Vec2;
  sprint: boolean;
  sequence: number;
  receivedTick: number;
  sentAt: number;
};

type ResidentState = SavedResidentV2 & {
  velocity: Vec2;
  route: Vec2[];
  routeIndex: number;
  routeTopologyVersion: number;
  routeStatus: ResidentTelemetry["routeStatus"];
  input: InputState;
  scheduleKey: string;
  intent: string;
  destinationName: string;
  reservationId: string | null;
  stuckSeconds: number;
  routeStartDistance: number;
  lastRouteDistance: number;
  replanAttempts: number;
  motionState: ResidentMotionState;
  waitSeconds: number;
  blockedReason: string | null;
  waitingForResidentId: number | null;
  waitingVenueId: number | null;
  retryAtMinute: number;
  lastClearPosition: Vec2;
  playerBlockedSeconds: number;
  routeWorkerStop: number;
  blockedEventSent: boolean;
  descent?: {
    startAltitude: number;
    elapsed: number;
    duration: number;
  };
};

type GoalPlan = {
  key: string;
  goal: GoalKind;
  destinationBuildingId: number | null;
  publicPlaceId?: string;
  action: ResidentAction;
  intent: string;
  minimumDwell: number;
};

const ACTION_CODE = new Map<ResidentAction, number>(ACTIONS.map((action, index) => [action, index]));
const WALK_SPEED = 2.6;
const PLAYER_WALK_SPEED = 4.6;
const PLAYER_BRISK_SPEED = 7.4;
const ACCELERATION = 3.5;
const PLAYER_ACCELERATION = 14;
const NATIVE_TURN_SPEED = Math.PI * 0.75;
const PLAYER_INPUT_TIMEOUT_TICKS = 30;
const MAX_ACTIVE_RESIDENTS = 24;
const ARRIVAL_DISTANCE = 0.15;
const OUTLINE_SCALE = 1.09;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerpAngle(current: number, target: number, amount: number) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * amount;
}

function moveToward(current: number, target: number, maximumDelta: number) {
  if (Math.abs(target - current) <= maximumDelta) return target;
  return current + Math.sign(target - current) * maximumDelta;
}

function copyNeeds(needs: ResidentNeeds): ResidentNeeds {
  return { rest: needs.rest, nourishment: needs.nourishment, belonging: needs.belonging, purpose: needs.purpose };
}

function collisionRadius(resident: Pick<ResidentStatic, "radius">) {
  return resident.radius * OUTLINE_SCALE;
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.z);
  return length > 1 ? { x: vector.x / length, z: vector.z / length } : vector;
}

export class FlatworldSimulation {
  world!: WorldStatic;
  residents: ResidentState[] = [];
  events: SimEvent[] = [];
  tick = 0;
  timeMinutes = 8 * 60 + 20;
  day = 1;
  paused = false;
  timeScale = 1;
  private eventId = 1;
  private nextPortalId = 1;
  private initialWalls: WorldStatic["walls"] = [];
  private initialPortals: WorldStatic["portals"] = [];
  private reservations = new Map<string, number>();
  private venueQueues = new Map<number, number[]>();
  private portalQueues = new Map<number, number[]>();
  private portalLeases = new Map<number, { residentId: number; grantedTick: number; expiresTick: number }>();
  private timeScaleBeforeControl = 1;
  private completedDrops: Array<{ residentId: number; message: string }> = [];
  private topologyUndo?: {
    walls: WorldStatic["walls"];
    portals: WorldStatic["portals"];
  };

  constructor(seed = 1884) {
    this.initialize(seed);
  }

  initialize(seed: number) {
    const built = buildWorld(seed);
    this.world = built.world;
    this.tick = 0;
    this.timeMinutes = 8 * 60 + 20;
    this.day = 1;
    this.events = [];
    this.eventId = 1;
    this.reservations.clear();
    this.venueQueues.clear();
    this.portalQueues.clear();
    this.portalLeases.clear();
    this.topologyUndo = undefined;
    this.completedDrops = [];
    this.nextPortalId = Math.max(0, ...this.world.portals.map((portal) => portal.id)) + 1;
    this.initialWalls = this.world.walls.map((wall) => ({ ...wall, a: { ...wall.a }, b: { ...wall.b } }));
    this.initialPortals = this.world.portals.map((portal) => ({ ...portal, a: { ...portal.a }, b: { ...portal.b } }));

    this.residents = built.residents.map((resident, index) => ({
      ...resident,
      position: { ...built.spawnPoints[index] },
      rotation: index === 18 ? Math.PI : ((index * 47) % 360) * Math.PI / 180,
      altitude: 0,
      dimensionalState: DimensionalState.OnPlane,
      action: "RestAtHome",
      goal: "home",
      destinationBuildingId: resident.homeBuildingId,
      destinationAnchorId: null,
      dwellUntilMinute: 0,
      controller: "ai",
      needs: { rest: 0.76 + (index % 4) * 0.045, nourishment: 0.68 + (index % 5) * 0.04, belonging: 0.62 + (index % 3) * 0.07, purpose: 0.58 + (index % 6) * 0.05 },
      institutionalStatus: (resident.sides - 3) / 9,
      higherDimensionBelief: 0.02,
      memories: [],
      velocity: { x: 0, z: 0 },
      route: [],
      routeIndex: 0,
      routeTopologyVersion: this.world.topologyVersion,
      routeStatus: "idle",
      input: { mode: "world", move: { x: 0, z: 0 }, sprint: false, sequence: 0, receivedTick: 0, sentAt: 0 },
      scheduleKey: "",
      intent: "Preparing for the day at home",
      destinationName: "Home",
      reservationId: null,
      stuckSeconds: 0,
      routeStartDistance: 0,
      lastRouteDistance: Number.POSITIVE_INFINITY,
      replanAttempts: 0,
      motionState: "idle",
      waitSeconds: 0,
      blockedReason: null,
      waitingForResidentId: null,
      waitingVenueId: null,
      retryAtMinute: 0,
      lastClearPosition: { ...built.spawnPoints[index] },
      playerBlockedSeconds: 0,
      routeWorkerStop: 0,
      blockedEventSent: false
    }));

    this.residents.forEach((resident) => {
      const plan = this.schedulePlan(resident);
      this.applyPlan(resident, plan, true);
    });
    this.emit("world", "Morning begins across a connected, working town.", [], { x: 0, z: 0 });
  }

  getResidentStatics(): ResidentStatic[] {
    return this.residents.map((resident) => ({
      id: resident.id,
      name: resident.name,
      sides: resident.sides,
      radius: resident.radius,
      color: resident.color,
      rim: resident.rim,
      homeBuildingId: resident.homeBuildingId,
      workplaceId: resident.workplaceId,
      homeSlot: resident.homeSlot,
      workSlot: resident.workSlot,
      role: resident.role,
      scheduleTemplate: resident.scheduleTemplate
    }));
  }

  private globalMinute() {
    return (this.day - 1) * 1440 + this.timeMinutes;
  }

  private venue(id: number | null): Venue | undefined {
    return id === null ? undefined : this.world.buildings.find((candidate) => candidate.id === id);
  }

  private venueOpen(venue: Venue) {
    return this.timeMinutes >= venue.openMinute && this.timeMinutes < venue.closeMinute;
  }

  private schedulePlan(resident: ResidentState): GoalPlan {
    const offset = ((resident.id * 37) % 75) - 37;
    const minute = (this.timeMinutes + offset + 1440) % 1440;
    const keyPrefix = `${this.day}-${resident.scheduleTemplate}`;
    const work = resident.workplaceId;
    const home = resident.homeBuildingId;

    if (resident.scheduleTemplate === "route-worker") {
      if (minute < 420 || minute >= 1200) return { key: `${keyPrefix}-home`, goal: "home", destinationBuildingId: home, action: "RestAtHome", intent: "Resting at home", minimumDwell: 20 };
      return { key: `${keyPrefix}-route-${resident.routeWorkerStop}`, goal: "delivery", destinationBuildingId: null, publicPlaceId: resident.id === 18 ? "courier-route" : "grounds-route", action: "Travel", intent: resident.id === 18 ? "Making a measured town delivery" : "Tending the town's common places", minimumDwell: 10 };
    }

    if (resident.scheduleTemplate === "restaurant") {
      if (minute < 540) return { key: `${keyPrefix}-home-am`, goal: "home", destinationBuildingId: home, action: "RestAtHome", intent: "Preparing at home before service", minimumDwell: 20 };
      if (minute < 630) return { key: `${keyPrefix}-errand`, goal: "errand", destinationBuildingId: this.world.groceryId, action: "Shop", intent: "Collecting provisions for the tea room", minimumDwell: 18 };
      if (minute < 870) return { key: `${keyPrefix}-lunch-service`, goal: "work", destinationBuildingId: work, action: "Work", intent: "Working the luncheon service", minimumDwell: 24 };
      if (minute < 1005) return { key: `${keyPrefix}-break`, goal: "leisure", destinationBuildingId: null, publicPlaceId: "west-common", action: "Leisure", intent: "Taking the afternoon interval", minimumDwell: 18 };
      if (minute < 1290) return { key: `${keyPrefix}-evening-service`, goal: "work", destinationBuildingId: work, action: "Work", intent: "Working the evening service", minimumDwell: 24 };
      return { key: `${keyPrefix}-home-pm`, goal: "home", destinationBuildingId: home, action: "RestAtHome", intent: "Returning home after service", minimumDwell: 20 };
    }

    const early = resident.scheduleTemplate === "early-service";
    const civic = resident.scheduleTemplate === "civic-split";
    const start = early ? 390 : civic ? 450 : 465;
    const lunchStart = civic ? 720 : 705;
    const lunchEnd = civic ? 780 : 775;
    const end = early ? 900 : civic ? 990 : 1020;
    if (minute < start) return { key: `${keyPrefix}-home-am`, goal: "home", destinationBuildingId: home, action: "RestAtHome", intent: "Beginning the day at home", minimumDwell: 20 };
    if (minute < lunchStart) return { key: `${keyPrefix}-work-am`, goal: "work", destinationBuildingId: work, action: "Work", intent: `Working as ${resident.role}`, minimumDwell: 24 };
    if (minute < lunchEnd) return { key: `${keyPrefix}-meal`, goal: "meal", destinationBuildingId: this.world.restaurantId, action: "Dine", intent: "Taking a midday meal", minimumDwell: 18 };
    if (minute < end) return { key: `${keyPrefix}-work-pm`, goal: "work", destinationBuildingId: work, action: "Work", intent: `Completing the day's ${resident.role} work`, minimumDwell: 24 };
    if (minute < end + 105) return { key: `${keyPrefix}-errand`, goal: "errand", destinationBuildingId: this.world.groceryId, action: "Shop", intent: "Completing a household errand", minimumDwell: 16 };
    if (minute < 1200) return { key: `${keyPrefix}-leisure`, goal: "leisure", destinationBuildingId: null, publicPlaceId: resident.id % 2 ? "east-garden" : "abbott-square", action: "Leisure", intent: "Spending the evening in public company", minimumDwell: 20 };
    return { key: `${keyPrefix}-home-pm`, goal: "home", destinationBuildingId: home, action: "RestAtHome", intent: "Returning home for the night", minimumDwell: 20 };
  }

  private routeWorkerTarget(resident: ResidentState): { anchor: ActivityAnchor; name: string } {
    if (resident.id === 18) {
      const sequence: Array<{ buildingId?: number; publicId?: string }> = [
        { buildingId: this.world.printworksId },
        { publicId: "abbott-square" },
        { buildingId: this.world.groceryId },
        { buildingId: this.world.buildings.find((building) => building.kind === "civic")!.id },
        { buildingId: this.world.buildings.find((building) => building.kind === "archive")!.id }
      ];
      const stop = sequence[resident.routeWorkerStop % sequence.length];
      if (stop.publicId) {
        const place = this.world.publicPlaces.find((candidate) => candidate.id === stop.publicId)!;
        return { anchor: place.anchors[resident.id % place.anchors.length], name: place.name };
      }
      const venue = this.venue(stop.buildingId!)!;
      const queue = venue.anchors.filter((candidate) => candidate.kind === "queue");
      const anchor = queue[resident.id % queue.length];
      return { anchor, name: venue.name };
    }
    const places = this.world.publicPlaces;
    const place = places[resident.routeWorkerStop % places.length];
    return { anchor: place.anchors[(resident.id + resident.routeWorkerStop) % place.anchors.length], name: place.name };
  }

  private anchorForPlan(resident: ResidentState, plan: GoalPlan): { anchor: ActivityAnchor; name: string } | undefined {
    if (plan.goal === "delivery") return this.routeWorkerTarget(resident);
    if (plan.publicPlaceId) {
      const place = this.world.publicPlaces.find((candidate) => candidate.id === plan.publicPlaceId);
      if (!place) return undefined;
      const available = place.anchors.find((anchor) => !this.reservations.has(anchor.id) || this.reservations.get(anchor.id) === resident.id);
      return available ? { anchor: available, name: place.name } : undefined;
    }
    const venue = this.venue(plan.destinationBuildingId);
    if (!venue) return undefined;
    if (!["home", "work"].includes(plan.goal) && !this.venueOpen(venue)) return undefined;
    let anchors: ActivityAnchor[];
    if (plan.goal === "home") anchors = venue.anchors.filter((anchor) => anchor.kind === "home");
    else if (plan.goal === "work") anchors = venue.anchors.filter((anchor) => anchor.kind === "staff");
    else anchors = venue.anchors.filter((anchor) => anchor.kind === "visitor");
    let anchor = plan.goal === "home"
      ? anchors[resident.homeSlot % Math.max(1, anchors.length)]
      : plan.goal === "work"
        ? anchors[resident.workSlot % Math.max(1, anchors.length)]
        : anchors.find((candidate) => !this.reservations.has(candidate.id) || this.reservations.get(candidate.id) === resident.id);
    return anchor ? { anchor, name: venue.name } : undefined;
  }

  private releaseReservation(resident: ResidentState) {
    if (resident.reservationId && this.reservations.get(resident.reservationId) === resident.id) this.reservations.delete(resident.reservationId);
    resident.reservationId = null;
    for (const [venueId, queue] of this.venueQueues) {
      const next = queue.filter((residentId) => residentId !== resident.id);
      if (next.length) this.venueQueues.set(venueId, next);
      else this.venueQueues.delete(venueId);
    }
    resident.waitingVenueId = null;
  }

  private routeDistance(resident: ResidentState) {
    if (!resident.route.length || resident.routeIndex >= resident.route.length) return 0;
    let distance = Math.hypot(
      resident.route[resident.routeIndex].x - resident.position.x,
      resident.route[resident.routeIndex].z - resident.position.z
    );
    for (let index = resident.routeIndex + 1; index < resident.route.length; index += 1) {
      distance += Math.hypot(
        resident.route[index].x - resident.route[index - 1].x,
        resident.route[index].z - resident.route[index - 1].z
      );
    }
    return distance;
  }

  private assignRoute(resident: ResidentState, anchor: ActivityAnchor, name: string) {
    resident.destinationAnchorId = anchor.id;
    resident.destinationName = name;
    resident.route = findPath(this.world, resident.position, anchor.position, collisionRadius(resident));
    resident.routeIndex = 0;
    resident.routeTopologyVersion = this.world.topologyVersion;
    resident.routeStartDistance = this.routeDistance(resident);
    resident.lastRouteDistance = resident.routeStartDistance;
    resident.stuckSeconds = 0;
    resident.replanAttempts = 0;
    resident.waitSeconds = 0;
    resident.waitingForResidentId = null;
    resident.blockedReason = null;
    if (!resident.route.length && Math.hypot(resident.position.x - anchor.position.x, resident.position.z - anchor.position.z) > 0.35) {
      resident.action = "Stranded";
      resident.routeStatus = "blocked";
      resident.motionState = "blocked";
      resident.blockedReason = "No connected planar route is available.";
      this.emitRouteBlocked(resident);
      return;
    }
    resident.action = resident.route.length ? "Travel" : resident.action;
    resident.routeStatus = resident.route.length ? "routing" : "arrived";
    resident.motionState = resident.route.length ? "moving" : "arrived";
    if (!resident.route.length) this.arrive(resident, anchor);
  }

  private enqueueForVenue(resident: ResidentState, venue: Venue) {
    const queue = this.venueQueues.get(venue.id) ?? [];
    if (!queue.includes(resident.id)) queue.push(resident.id);
    this.venueQueues.set(venue.id, queue);
    const queueAnchors = venue.anchors.filter((anchor) => anchor.kind === "queue");
    const queueIndex = queue.indexOf(resident.id);
    const anchor = queueAnchors[Math.min(queueIndex, queueAnchors.length - 1)];
    resident.waitingVenueId = venue.id;
    resident.retryAtMinute = this.globalMinute() + 5;
    resident.action = "Queue";
    resident.motionState = "moving";
    resident.blockedReason = `${venue.shortName} is full; joining its orderly queue.`;
    if (anchor) {
      this.reservations.set(anchor.id, resident.id);
      resident.reservationId = anchor.id;
      this.assignRoute(resident, anchor, venue.name);
      resident.blockedReason = `${venue.shortName} is full; joining its orderly queue.`;
    } else {
      resident.route = [];
      resident.routeStatus = "blocked";
      resident.motionState = "waiting-capacity";
    }
  }

  private promoteVenueQueues() {
    for (const [venueId, queue] of [...this.venueQueues]) {
      const venue = this.venue(venueId);
      if (!venue || !this.venueOpen(venue)) continue;
      const visitors = venue.anchors.filter((anchor) => anchor.kind === "visitor");
      let available = visitors.find((anchor) => !this.reservations.has(anchor.id));
      while (available && queue.length) {
        const residentId = queue.shift()!;
        const resident = this.residents[residentId];
        if (!resident || resident.controller === "player" || resident.dimensionalState !== DimensionalState.OnPlane) {
          available = visitors.find((anchor) => !this.reservations.has(anchor.id));
          continue;
        }
        if (resident.reservationId && this.reservations.get(resident.reservationId) === resident.id) this.reservations.delete(resident.reservationId);
        this.reservations.set(available.id, resident.id);
        resident.reservationId = available.id;
        resident.waitingVenueId = null;
        resident.intent = resident.goal === "meal" ? "Taking a midday meal" : "Completing a household errand";
        this.assignRoute(resident, available, venue.name);
        available = visitors.find((anchor) => !this.reservations.has(anchor.id));
      }
      if (queue.length) this.venueQueues.set(venueId, queue);
      else this.venueQueues.delete(venueId);
    }
  }

  private applyPlan(resident: ResidentState, plan: GoalPlan, immediate = false) {
    if (!immediate && resident.scheduleKey === plan.key) return;
    this.releaseReservation(resident);
    const target = this.anchorForPlan(resident, plan);
    resident.scheduleKey = plan.key;
    resident.goal = plan.goal;
    resident.destinationBuildingId = plan.destinationBuildingId;
    resident.intent = plan.intent;
    resident.dwellUntilMinute = this.globalMinute() + plan.minimumDwell;
    resident.blockedEventSent = false;
    if (!target) {
      const venue = this.venue(plan.destinationBuildingId);
      if (venue && !["home", "work"].includes(plan.goal) && this.venueOpen(venue)) {
        this.enqueueForVenue(resident, venue);
        return;
      }
      resident.action = "Queue";
      resident.routeStatus = "blocked";
      resident.motionState = "waiting-capacity";
      resident.destinationName = venue?.name ?? "A full public place";
      resident.blockedReason = venue && !this.venueOpen(venue) ? `${venue.shortName} is closed.` : "Every activity position is occupied.";
      resident.retryAtMinute = this.globalMinute() + 5;
      resident.route = [];
      return;
    }
    if (target.anchor.kind === "visitor" || target.anchor.kind === "queue") {
      this.reservations.set(target.anchor.id, resident.id);
      resident.reservationId = target.anchor.id;
    }
    resident.action = plan.action;
    this.assignRoute(resident, target.anchor, target.name);
  }

  private desiredAction(goal: GoalKind): ResidentAction {
    if (goal === "home") return "RestAtHome";
    if (goal === "work" || goal === "delivery") return "Work";
    if (goal === "meal") return "Dine";
    if (goal === "errand") return "Shop";
    if (goal === "leisure") return "Leisure";
    return "Stranded";
  }

  private arrive(resident: ResidentState, anchor?: ActivityAnchor) {
    if (resident.goal === "seek-exit") {
      resident.route = [];
      resident.routeStatus = "arrived";
      resident.motionState = "arrived";
      resident.velocity = { x: 0, z: 0 };
      resident.scheduleKey = "";
      this.emit("route", `${resident.name} reaches familiar streets and resumes the day.`, [resident.id], resident.position);
      this.applyPlan(resident, this.schedulePlan(resident), true);
      return;
    }
    resident.route = [];
    resident.routeIndex = 0;
    resident.routeStatus = "arrived";
    if (resident.waitingVenueId !== null && anchor?.kind === "queue") {
      resident.velocity = { x: 0, z: 0 };
      resident.action = "Queue";
      resident.motionState = "waiting-capacity";
      resident.blockedReason = `Waiting for an opening at ${resident.destinationName}.`;
      return;
    }
    resident.motionState = "arrived";
    resident.velocity = { x: 0, z: 0 };
    resident.action = this.desiredAction(resident.goal);
    resident.dwellUntilMinute = Math.max(resident.dwellUntilMinute, this.globalMinute() + (resident.goal === "delivery" ? 10 : 15));
    if (anchor) resident.rotation = anchor.facing;
    const activity = resident.goal === "home"
      ? "settles at home"
      : resident.goal === "work" || resident.goal === "delivery"
        ? "begins work"
        : resident.goal === "meal"
          ? "takes a meal"
          : resident.goal === "errand"
            ? "begins shopping"
            : "joins public life";
    this.emit("activity", `${resident.name} ${activity} at ${resident.destinationName}.`, [resident.id], resident.position, resident.destinationBuildingId ?? undefined);
  }

  private emitRouteBlocked(resident: ResidentState) {
    if (resident.blockedEventSent) return;
    resident.blockedEventSent = true;
    this.emit("route", `${resident.name} can find no planar route from this region.`, [resident.id], resident.position, resident.destinationBuildingId ?? undefined);
  }

  private updateSchedules() {
    this.promoteVenueQueues();
    for (const resident of this.residents) {
      if (resident.controller === "player" || resident.dimensionalState !== DimensionalState.OnPlane) continue;
      if (resident.goal === "seek-exit") continue;
      if (resident.goal === "delivery" && resident.routeStatus === "arrived" && this.globalMinute() >= resident.dwellUntilMinute) {
        resident.routeWorkerStop += 1;
        resident.scheduleKey = "";
      }
      const emergencyRest = resident.needs.rest < 0.13;
      const emergencyThreshold = 0.1 + (resident.id % 5) * 0.008;
      const emergencyMeal = resident.needs.nourishment < emergencyThreshold && this.timeMinutes > 660 && this.timeMinutes < 1260;
      const plan = emergencyRest
        ? { key: `${this.day}-need-rest`, goal: "home" as const, destinationBuildingId: resident.homeBuildingId, action: "RestAtHome" as const, intent: "Returning home to recover", minimumDwell: 35 }
        : emergencyMeal
          ? { key: `${this.day}-need-meal`, goal: "meal" as const, destinationBuildingId: this.world.restaurantId, action: "Dine" as const, intent: "Seeking a needed meal", minimumDwell: 25 }
          : this.schedulePlan(resident);
      if (resident.scheduleKey !== plan.key && (this.globalMinute() >= resident.dwellUntilMinute || emergencyRest || emergencyMeal)) this.applyPlan(resident, plan);
      if (resident.motionState === "waiting-capacity" && resident.waitingVenueId === null && this.globalMinute() >= resident.retryAtMinute) this.applyPlan(resident, plan, true);
      if (resident.routeStatus === "blocked" && resident.routeTopologyVersion !== this.world.topologyVersion) this.applyPlan(resident, plan, true);
    }
  }

  step(dt = 1 / 30) {
    // A return to the plane is physical screen time, not accelerated town time.
    // It therefore continues while the town clock is paused and at every time scale.
    this.stepDescents(dt);
    if (this.paused) return;
    let remaining = dt * this.timeScale;
    while (remaining > 0.000001) {
      const substep = Math.min(1 / 30, remaining);
      this.stepSubstep(substep);
      remaining -= substep;
    }
  }

  private stepDescents(dt: number) {
    for (const resident of this.residents) {
      const descent = resident.descent;
      if (!descent || resident.dimensionalState !== DimensionalState.BeingReinserted) continue;
      descent.elapsed = Math.min(descent.duration, descent.elapsed + dt);
      const progress = descent.elapsed / descent.duration;
      resident.altitude = descent.startAltitude * (1 - progress * progress);
      if (progress < 1) continue;
      const response = this.completeReinsert(resident, resident.position);
      this.completedDrops.push({ residentId: resident.id, message: response.message });
    }
  }

  takeCompletedDrops() {
    const completed = this.completedDrops;
    this.completedDrops = [];
    return completed;
  }

  private stepSubstep(dt: number) {
    this.tick += 1;
    const previousMinute = this.timeMinutes;
    this.timeMinutes += dt * 2.4;
    if (this.timeMinutes >= 1440) {
      this.timeMinutes %= 1440;
      this.day += 1;
      this.residents.forEach((resident) => { resident.scheduleKey = ""; });
    }
    const simulatedMinutes = previousMinute <= this.timeMinutes ? this.timeMinutes - previousMinute : 1440 - previousMinute + this.timeMinutes;
    this.updateNeeds(simulatedMinutes);
    if (this.tick % 6 === 0) this.updateSchedules();
    this.stepResidents(dt);
  }

  private updateNeeds(minutes: number) {
    for (const resident of this.residents) {
      if (resident.action === "RestAtHome") resident.needs.rest = clamp(resident.needs.rest + minutes * 0.006, 0, 1);
      else resident.needs.rest = clamp(resident.needs.rest - minutes * 0.0007, 0, 1);
      if (resident.action === "Dine") resident.needs.nourishment = clamp(resident.needs.nourishment + minutes * 0.012, 0, 1);
      else resident.needs.nourishment = clamp(resident.needs.nourishment - minutes * 0.001, 0, 1);
      if (resident.action === "Leisure" || resident.action === "Socialize") resident.needs.belonging = clamp(resident.needs.belonging + minutes * 0.006, 0, 1);
      else resident.needs.belonging = clamp(resident.needs.belonging - minutes * 0.00035, 0, 1);
      if (resident.action === "Work") resident.needs.purpose = clamp(resident.needs.purpose + minutes * 0.004, 0, 1);
      else resident.needs.purpose = clamp(resident.needs.purpose - minutes * 0.0003, 0, 1);
    }
  }

  private preferredVelocity(resident: ResidentState, dt: number): Vec2 {
    if (resident.dimensionalState !== DimensionalState.OnPlane) return { x: 0, z: 0 };
    resident.waitingForResidentId = null;
    if (resident.controller === "player") {
      resident.action = "PlayerControlled";
      resident.routeStatus = "idle";
      resident.motionState = "controlled";
      const input = this.tick - resident.input.receivedTick > PLAYER_INPUT_TIMEOUT_TICKS ? { x: 0, z: 0 } : resident.input.move;
      const speed = resident.input.sprint ? PLAYER_BRISK_SPEED : PLAYER_WALK_SPEED;
      if (resident.input.mode === "steering") {
        resident.rotation += input.x * NATIVE_TURN_SPEED * dt;
        return {
          x: Math.sin(resident.rotation) * input.z * speed,
          z: Math.cos(resident.rotation) * input.z * speed
        };
      }
      return { x: input.x * speed, z: input.z * speed };
    }
    if (resident.routeStatus !== "routing" || !resident.route.length) return { x: 0, z: 0 };
    if (resident.routeTopologyVersion !== this.world.topologyVersion) {
      this.applyPlan(resident, this.schedulePlan(resident), true);
      if (resident.routeStatus !== "routing") return { x: 0, z: 0 };
    }
    let waypoint = resident.route[resident.routeIndex];
    while (waypoint && Math.hypot(waypoint.x - resident.position.x, waypoint.z - resident.position.z) <= ARRIVAL_DISTANCE) {
      resident.routeIndex += 1;
      if (resident.routeIndex >= resident.route.length) {
        this.arrive(resident, this.findAnchor(resident.destinationAnchorId));
        return { x: 0, z: 0 };
      }
      waypoint = resident.route[resident.routeIndex];
    }
    if (!waypoint) return { x: 0, z: 0 };
    const dx = waypoint.x - resident.position.x;
    const dz = waypoint.z - resident.position.z;
    const distance = Math.max(0.0001, Math.hypot(dx, dz));
    const final = resident.routeIndex === resident.route.length - 1;
    const speed = final && distance < 1.4 ? WALK_SPEED * clamp(distance / 1.4, 0.18, 1) : WALK_SPEED;
    resident.action = "Travel";
    resident.motionState = "moving";
    resident.blockedReason = null;
    return { x: dx / distance * speed, z: dz / distance * speed };
  }

  private portalPermission(resident: ResidentState, desired: Vec2, dt: number) {
    if (Math.hypot(desired.x, desired.z) < 0.1) return true;
    const crossing = this.world.portals
      .filter((portal) => Math.hypot(portal.b.x - portal.a.x, portal.b.z - portal.a.z) >= collisionRadius(resident) * 2 + 0.18)
      .map((portal) => {
        const center = { x: (portal.a.x + portal.b.x) / 2, z: (portal.a.z + portal.b.z) / 2 };
        return {
          portal,
          center,
          distance: Math.hypot(center.x - resident.position.x, center.z - resident.position.z)
        };
      })
      .filter((candidate) => candidate.distance < 4.6)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!crossing) return true;
    const toward = desired.x * (crossing.center.x - resident.position.x)
      + desired.z * (crossing.center.z - resident.position.z);
    if (toward <= 0) return true;
    const portalId = crossing.portal.id;
    const queue = this.portalQueues.get(portalId) ?? [];
    if (!queue.includes(resident.id)) {
      if (resident.controller === "player") queue.unshift(resident.id);
      else queue.push(resident.id);
      this.portalQueues.set(portalId, queue);
    }
    let lease = this.portalLeases.get(portalId);
    if (lease && (this.tick >= lease.expiresTick || this.residents[lease.residentId]?.dimensionalState !== DimensionalState.OnPlane)) {
      this.portalLeases.delete(portalId);
      lease = undefined;
    }
    if (!lease && queue.length) {
      lease = { residentId: queue[0], grantedTick: this.tick, expiresTick: this.tick + 90 };
      this.portalLeases.set(portalId, lease);
    }
    if (lease?.residentId === resident.id) return true;
    const venue = this.world.buildings.find((candidate) => (
      candidate.regionId === crossing.portal.regionA || candidate.regionId === crossing.portal.regionB
    ));
    resident.motionState = "waiting-portal";
    resident.blockedReason = venue
      ? `Yielding at the ${venue.shortName} opening.`
      : "Yielding at an opening while another citizen crosses.";
    resident.waitingForResidentId = lease?.residentId ?? null;
    return false;
  }

  private slideAlongWall(resident: ResidentState, velocity: Vec2, dt: number): Vec2 {
    const radius = collisionRadius(resident);
    const next = {
      x: clamp(resident.position.x + velocity.x * dt, this.world.bounds.minX + radius, this.world.bounds.maxX - radius),
      z: clamp(resident.position.z + velocity.z * dt, this.world.bounds.minZ + radius, this.world.bounds.maxZ - radius)
    };
    if (!wallCollision(next, radius, this.world.walls)) return next;
    const wall = nearestWall(next, this.world.walls, radius + 0.6);
    if (!wall) return { ...resident.position };
    const dx = wall.b.x - wall.a.x;
    const dz = wall.b.z - wall.a.z;
    const length = Math.max(0.0001, Math.hypot(dx, dz));
    const tangent = { x: dx / length, z: dz / length };
    const along = velocity.x * tangent.x + velocity.z * tangent.z;
    const slide = {
      x: clamp(resident.position.x + tangent.x * along * dt, this.world.bounds.minX + radius, this.world.bounds.maxX - radius),
      z: clamp(resident.position.z + tangent.z * along * dt, this.world.bounds.minZ + radius, this.world.bounds.maxZ - radius)
    };
    return wallCollision(slide, radius, this.world.walls) ? { ...resident.position } : slide;
  }

  private releaseFinishedPortalLeases() {
    for (const [portalId, lease] of [...this.portalLeases]) {
      const resident = this.residents[lease.residentId];
      const portal = this.world.portals.find((candidate) => candidate.id === portalId);
      const center = portal ? { x: (portal.a.x + portal.b.x) / 2, z: (portal.a.z + portal.b.z) / 2 } : undefined;
      const distance = resident && center ? Math.hypot(resident.position.x - center.x, resident.position.z - center.z) : Number.POSITIVE_INFINITY;
      if (this.tick >= lease.expiresTick || (this.tick - lease.grantedTick > 12 && distance > 4.5)) {
        this.portalLeases.delete(portalId);
        const queue = (this.portalQueues.get(portalId) ?? []).filter((residentId) => residentId !== lease.residentId);
        if (queue.length) this.portalQueues.set(portalId, queue);
        else this.portalQueues.delete(portalId);
      }
    }
  }

  private stepResidents(dt: number) {
    const count = this.residents.length;
    const poses = this.residents.map((resident) => ({ position: { ...resident.position }, velocity: { ...resident.velocity } }));
    const desired = this.residents.map((resident) => this.preferredVelocity(resident, dt));

    for (let first = 0; first < count; first += 1) {
      const a = this.residents[first];
      if (a.dimensionalState !== DimensionalState.OnPlane) continue;
      for (let second = first + 1; second < count; second += 1) {
        const b = this.residents[second];
        if (b.dimensionalState !== DimensionalState.OnPlane) continue;
        const futureA = { x: poses[first].position.x + desired[first].x * 0.55, z: poses[first].position.z + desired[first].z * 0.55 };
        const futureB = { x: poses[second].position.x + desired[second].x * 0.55, z: poses[second].position.z + desired[second].z * 0.55 };
        let dx = futureA.x - futureB.x;
        let dz = futureA.z - futureB.z;
        let distance = Math.hypot(dx, dz);
        const preferred = collisionRadius(a) + collisionRadius(b) + 0.16;
        if (distance >= preferred + 0.55) continue;
        if (distance < 0.0001) {
          const angle = ((a.id + 1) * 2.399963229728653) % (Math.PI * 2);
          dx = Math.cos(angle);
          dz = Math.sin(angle);
          distance = 1;
        }
        const strength = clamp((preferred + 0.55 - distance) / (preferred + 0.55), 0, 1) * 2.25;
        const nx = dx / distance;
        const nz = dz / distance;
        const aShare = a.controller === "player" && b.controller !== "player" ? 0.18 : b.controller === "player" && a.controller !== "player" ? 0.82 : 0.5;
        const bShare = 1 - aShare;
        desired[first].x += nx * strength * aShare;
        desired[first].z += nz * strength * aShare;
        desired[second].x -= nx * strength * bShare;
        desired[second].z -= nz * strength * bShare;
      }
    }

    const candidates = this.residents.map((resident, index) => {
      if (resident.dimensionalState !== DimensionalState.OnPlane) return { ...resident.position };
      const maximum = resident.controller === "player"
        ? resident.input.sprint ? PLAYER_BRISK_SPEED : PLAYER_WALK_SPEED
        : WALK_SPEED;
      const acceleration = resident.controller === "player" ? PLAYER_ACCELERATION : ACCELERATION;
      const normalized = normalize({ x: desired[index].x / maximum, z: desired[index].z / maximum });
      const targetVelocity = { x: normalized.x * maximum, z: normalized.z * maximum };
      if (!this.portalPermission(resident, targetVelocity, dt)) return { ...resident.position };
      const velocity = {
        x: moveToward(resident.velocity.x, targetVelocity.x, acceleration * dt),
        z: moveToward(resident.velocity.z, targetVelocity.z, acceleration * dt)
      };
      return this.slideAlongWall(resident, velocity, dt);
    });

    for (let iteration = 0; iteration < 3; iteration += 1) {
      for (let first = 0; first < count; first += 1) {
        const a = this.residents[first];
        if (a.dimensionalState !== DimensionalState.OnPlane) continue;
        for (let second = first + 1; second < count; second += 1) {
          const b = this.residents[second];
          if (b.dimensionalState !== DimensionalState.OnPlane) continue;
          let dx = candidates[first].x - candidates[second].x;
          let dz = candidates[first].z - candidates[second].z;
          let distance = Math.hypot(dx, dz);
          const minimum = collisionRadius(a) + collisionRadius(b) + 0.01;
          if (distance >= minimum) continue;
          if (distance < 0.0001) {
            const angle = ((a.id + 1) * 2.399963229728653) % (Math.PI * 2);
            dx = Math.cos(angle);
            dz = Math.sin(angle);
            distance = 1;
          }
          const overlap = minimum - distance;
          const nx = dx / distance;
          const nz = dz / distance;
          const aShare = a.controller === "player" && b.controller !== "player" ? 0.2 : b.controller === "player" && a.controller !== "player" ? 0.8 : 0.5;
          const nextA = { x: candidates[first].x + nx * overlap * aShare, z: candidates[first].z + nz * overlap * aShare };
          const nextB = { x: candidates[second].x - nx * overlap * (1 - aShare), z: candidates[second].z - nz * overlap * (1 - aShare) };
          if (!wallCollision(nextA, collisionRadius(a), this.world.walls)) candidates[first] = nextA;
          if (!wallCollision(nextB, collisionRadius(b), this.world.walls)) candidates[second] = nextB;
        }
      }
    }

    this.residents.forEach((resident, index) => {
      if (resident.dimensionalState !== DimensionalState.OnPlane) return;
      const before = poses[index].position;
      const velocity = { x: (candidates[index].x - before.x) / dt, z: (candidates[index].z - before.z) / dt };
      resident.position = candidates[index];
      resident.velocity = velocity;
      const speed = Math.hypot(velocity.x, velocity.z);
      if (speed > 0.08 && !(resident.controller === "player" && resident.input.mode === "steering")) {
        resident.rotation = lerpAngle(resident.rotation, Math.atan2(velocity.x, velocity.z), Math.min(1, dt * 8));
      }

      if (resident.controller === "player") {
        const trying = resident.input.mode === "steering"
          ? Math.abs(resident.input.move.z) > 0.1
          : Math.hypot(resident.input.move.x, resident.input.move.z) > 0.1;
        resident.playerBlockedSeconds = trying && speed < 0.08 ? resident.playerBlockedSeconds + dt : 0;
        resident.blockedReason = resident.playerBlockedSeconds > 2 ? "The way is blocked. Back away or return to the last clear place." : null;
        if (speed > 0.25) resident.lastClearPosition = { ...resident.position };
        return;
      }

      if (resident.motionState === "waiting-capacity" || resident.motionState === "waiting-portal") {
        resident.waitSeconds += dt;
        if (resident.waitSeconds >= 8 && !resident.blockedEventSent) {
          resident.blockedEventSent = true;
          const summary = resident.motionState === "waiting-capacity"
            ? `${resident.name} waits outside ${resident.destinationName}; the admission queue is moving in order.`
            : `${resident.name} yields at a doorway while another citizen crosses.`;
          this.emit("route", summary, [resident.id], resident.position, resident.waitingVenueId ?? undefined);
        }
        return;
      }
      if (resident.routeStatus !== "routing") return;
      const remaining = this.routeDistance(resident);
      if (remaining < resident.lastRouteDistance - 0.02) {
        resident.lastRouteDistance = remaining;
        resident.stuckSeconds = 0;
        resident.replanAttempts = 0;
      } else resident.stuckSeconds += dt;
      if (resident.stuckSeconds > 1.25) {
        resident.motionState = "blocked";
        resident.blockedReason = "Yielding while the route ahead clears.";
      }
      if (resident.stuckSeconds > 2.5 && resident.replanAttempts === 0) {
        const target = this.findAnchor(resident.destinationAnchorId);
        if (target) {
          resident.route = findPath(this.world, resident.position, target.position, collisionRadius(resident));
          resident.routeIndex = 0;
          resident.routeTopologyVersion = this.world.topologyVersion;
          resident.lastRouteDistance = this.routeDistance(resident);
          resident.replanAttempts = 1;
        }
      }
      if (resident.stuckSeconds > 6) {
        this.releaseReservation(resident);
        resident.scheduleKey = "";
        this.applyPlan(resident, this.schedulePlan(resident), true);
      }
    });
    this.releaseFinishedPortalLeases();
  }

  private findAnchor(id: string | null): ActivityAnchor | undefined {
    if (!id) return undefined;
    for (const building of this.world.buildings) {
      const anchor = building.anchors.find((candidate) => candidate.id === id);
      if (anchor) return anchor;
    }
    for (const place of this.world.publicPlaces) {
      const anchor = place.anchors.find((candidate) => candidate.id === id);
      if (anchor) return anchor;
    }
    return undefined;
  }

  beginControl(residentId: number): { ok: boolean; message: string } {
    const resident = this.residents[residentId];
    if (!resident || resident.dimensionalState !== DimensionalState.OnPlane) return { ok: false, message: "That citizen is not available for planar control." };
    this.residents.forEach((candidate) => {
      if (candidate.controller === "player") this.endControl(candidate.id, true);
    });
    this.releaseReservation(resident);
    this.timeScaleBeforeControl = this.timeScale;
    this.timeScale = 1;
    resident.controller = "player";
    resident.input = { mode: "world", move: { x: 0, z: 0 }, sprint: false, sequence: 0, receivedTick: this.tick, sentAt: 0 };
    resident.velocity = { x: 0, z: 0 };
    resident.route = [];
    resident.routeStatus = "idle";
    resident.motionState = "controlled";
    resident.blockedReason = null;
    resident.waitSeconds = 0;
    resident.action = "PlayerControlled";
    resident.intent = "Waiting for your input";
    resident.destinationBuildingId = null;
    resident.destinationAnchorId = null;
    resident.destinationName = "Your chosen path";
    return { ok: true, message: `You now control ${resident.name}. Their routine is paused until you release them.` };
  }

  setInput(residentId: number, move: Vec2, sprint: boolean, sequence = 0, sentAt = 0): boolean {
    const resident = this.residents[residentId];
    if (!resident || resident.controller !== "player") return false;
    if (sequence < resident.input.sequence) return false;
    resident.input = { mode: "world", move: normalize({ x: clamp(move.x, -1, 1), z: clamp(move.z, -1, 1) }), sprint, sequence, receivedTick: this.tick, sentAt };
    return true;
  }

  setSteeringInput(residentId: number, forward: number, turn: number, sprint: boolean, sequence = 0, sentAt = 0): boolean {
    const resident = this.residents[residentId];
    if (!resident || resident.controller !== "player") return false;
    if (sequence < resident.input.sequence) return false;
    resident.input = {
      mode: "steering",
      move: { x: clamp(turn, -1, 1), z: clamp(forward, -1, 1) },
      sprint,
      sequence,
      receivedTick: this.tick,
      sentAt
    };
    return true;
  }

  endControl(residentId: number, resumeRoutine: boolean): { ok: boolean; message: string } {
    const resident = this.residents[residentId];
    if (!resident || resident.controller !== "player") return { ok: false, message: "That citizen is not currently under your control." };
    resident.controller = "ai";
    resident.input = { mode: "world", move: { x: 0, z: 0 }, sprint: false, sequence: resident.input.sequence + 1, receivedTick: this.tick, sentAt: 0 };
    resident.velocity = { x: 0, z: 0 };
    this.timeScale = this.timeScaleBeforeControl;
    resident.scheduleKey = "";
    if (resumeRoutine) this.applyPlan(resident, this.schedulePlan(resident), true);
    return { ok: true, message: `${resident.name} resumes their own routine from this position.` };
  }

  recoverResident(residentId: number): { ok: boolean; message: string } {
    const resident = this.residents[residentId];
    if (!resident || resident.controller !== "player") return { ok: false, message: "Only the citizen under your control can be returned." };
    resident.position = { ...resident.lastClearPosition };
    resident.velocity = { x: 0, z: 0 };
    resident.input = { ...resident.input, move: { x: 0, z: 0 }, receivedTick: this.tick };
    resident.playerBlockedSeconds = 0;
    resident.blockedReason = null;
    return { ok: true, message: `${resident.name} returns to the last clear place.` };
  }

  createResident(profile: ResidentProfile): { ok: boolean; message: string; resident?: ResidentStatic } {
    if (this.residents.length >= MAX_ACTIVE_RESIDENTS) return { ok: false, message: "The two guest houses are full; this town can support twenty-four active citizens." };
    const occupancy = new Map<number, number>();
    const employment = new Map<number, number>();
    for (const resident of this.residents) {
      occupancy.set(resident.homeBuildingId, (occupancy.get(resident.homeBuildingId) ?? 0) + 1);
      if (resident.scheduleTemplate !== "route-worker") employment.set(resident.workplaceId, (employment.get(resident.workplaceId) ?? 0) + 1);
    }
    const home = this.world.buildings.find((building) => building.kind === "home" && (occupancy.get(building.id) ?? 0) < 2);
    const workplace = this.world.buildings.find((building) => building.staffCapacity > 0 && (employment.get(building.id) ?? 0) < building.staffCapacity);
    if (!home || !workplace) return { ok: false, message: "No compatible home and occupation are currently available." };
    const id = this.residents.length;
    const homeSlot = occupancy.get(home.id) ?? 0;
    const workSlot = employment.get(workplace.id) ?? 0;
    const staticResident: ResidentStatic = {
      id,
      name: profile.name.trim() || `Citizen ${id + 1}`,
      sides: profile.sides,
      radius: 0.72 + profile.sides * 0.035,
      color: profile.color,
      rim: profile.rim,
      homeBuildingId: home.id,
      workplaceId: workplace.id,
      homeSlot,
      workSlot,
      role: `apprentice ${workplace.shortName.toLowerCase()} worker`,
      scheduleTemplate: workplace.kind === "restaurant" ? "restaurant" : workplace.kind === "grocery" ? "early-service" : "day-worker"
    };
    const anchor = home.anchors.filter((candidate) => candidate.kind === "home")[homeSlot];
    const resident: ResidentState = {
      ...staticResident,
      position: { ...anchor.position },
      rotation: anchor.facing,
      altitude: 0,
      dimensionalState: DimensionalState.OnPlane,
      action: "RestAtHome",
      goal: "home",
      destinationBuildingId: home.id,
      destinationAnchorId: anchor.id,
      dwellUntilMinute: 0,
      controller: "ai",
      needs: { rest: 1, nourishment: 0.85, belonging: 0.7, purpose: 0.65 },
      institutionalStatus: 0.35,
      higherDimensionBelief: 0.08,
      memories: [],
      velocity: { x: 0, z: 0 },
      route: [],
      routeIndex: 0,
      routeTopologyVersion: this.world.topologyVersion,
      routeStatus: "arrived",
      input: { mode: "world", move: { x: 0, z: 0 }, sprint: false, sequence: 0, receivedTick: this.tick, sentAt: 0 },
      scheduleKey: "",
      intent: "Arriving at a new home",
      destinationName: home.name,
      reservationId: null,
      stuckSeconds: 0,
      routeStartDistance: 0,
      lastRouteDistance: 0,
      replanAttempts: 0,
      motionState: "arrived",
      waitSeconds: 0,
      blockedReason: null,
      waitingForResidentId: null,
      waitingVenueId: null,
      retryAtMinute: 0,
      lastClearPosition: { ...anchor.position },
      playerBlockedSeconds: 0,
      routeWorkerStop: 0,
      blockedEventSent: false
    };
    this.residents.push(resident);
    this.emit("arrival", `${resident.name} joins ${home.shortName} and takes work at ${workplace.shortName}.`, [id], resident.position, home.id);
    return { ok: true, message: `${resident.name} has joined the town, living at ${home.shortName} and working at ${workplace.shortName}.`, resident: staticResident };
  }

  private captureTopologyUndo() {
    this.topologyUndo = {
      walls: this.world.walls.map((wall) => ({ ...wall, a: { ...wall.a }, b: { ...wall.b } })),
      portals: this.world.portals.map((portal) => ({ ...portal, a: { ...portal.a }, b: { ...portal.b } }))
    };
  }

  undoIntervention(): { ok: boolean; message: string } {
    const remembered = this.topologyUndo;
    if (!remembered) return { ok: false, message: "There is no recent plane change to undo." };
    this.world = {
      ...this.world,
      topologyVersion: this.world.topologyVersion + 1,
      walls: remembered.walls.map((wall) => ({ ...wall, a: { ...wall.a }, b: { ...wall.b } })),
      portals: remembered.portals.map((portal) => ({ ...portal, a: { ...portal.a }, b: { ...portal.b } }))
    };
    this.topologyUndo = undefined;
    this.reservations.clear();
    this.venueQueues.clear();
    this.replanAfterTopologyChange();
    this.emit("intervention", "The latest plane change is undone.", []);
    return { ok: true, message: "The latest plane change has been undone." };
  }

  lift(residentId: number): { ok: boolean; message: string } {
    const resident = this.residents[residentId];
    if (!resident || resident.dimensionalState !== DimensionalState.OnPlane) return { ok: false, message: "That citizen cannot be lifted now." };
    this.releaseReservation(resident);
    resident.dimensionalState = DimensionalState.OffPlane;
    resident.descent = undefined;
    resident.altitude = 5;
    resident.velocity = { x: 0, z: 0 };
    resident.action = "Stranded";
    resident.routeStatus = "idle";
    resident.motionState = "idle";
    resident.intent = "Suspended beyond every planar relation";
    resident.destinationBuildingId = null;
    resident.destinationAnchorId = null;
    resident.destinationName = "Above the plane";
    resident.higherDimensionBelief = clamp(resident.higherDimensionBelief + 0.42, 0, 1);
    resident.memories.push({ type: "lifted", tick: this.tick, position: { ...resident.position }, confidence: 1 });
    this.emit("dimensional", `${resident.name} vanishes upward from every familiar line of sight.`, [residentId], resident.position);
    return { ok: true, message: `${resident.name} is above the plane.` };
  }

  moveLifted(residentId: number, target: Vec2, altitude = 5) {
    const resident = this.residents[residentId];
    if (!resident || resident.dimensionalState !== DimensionalState.OffPlane) return false;
    resident.position = { x: clamp(target.x, this.world.bounds.minX, this.world.bounds.maxX), z: clamp(target.z, this.world.bounds.minZ, this.world.bounds.maxZ) };
    resident.altitude = clamp(altitude, 1.5, 14);
    return true;
  }

  rotateLifted(residentId: number, radians: number) {
    const resident = this.residents[residentId];
    if (resident?.dimensionalState === DimensionalState.OffPlane) resident.rotation += radians;
  }

  drop(residentId: number, target?: Vec2, reducedMotion = false): { ok: boolean; message: string } {
    const resident = this.residents[residentId];
    if (!resident || resident.dimensionalState !== DimensionalState.OffPlane) return { ok: false, message: "Lift a citizen before dropping them." };
    const landing = target ?? resident.position;
    if (wallCollision(landing, collisionRadius(resident), this.world.walls)) return { ok: false, message: "Move clear of the boundary before dropping this citizen." };
    const startAltitude = Math.max(1.5, resident.altitude);
    resident.position = { ...landing };
    resident.dimensionalState = DimensionalState.BeingReinserted;
    resident.velocity = { x: 0, z: 0 };
    resident.intent = "Falling back toward Flatland";
    resident.destinationName = "The plane below";
    resident.descent = {
      startAltitude,
      elapsed: 0,
      duration: reducedMotion ? 0.18 : clamp(0.85 + Math.sqrt(startAltitude) * 0.25, 1.1, 1.8)
    };
    this.emit("dimensional", `${resident.name} is released and begins falling back toward the plane.`, [residentId], resident.position);
    return { ok: true, message: `${resident.name} is falling back toward Flatland.` };
  }

  reinsert(residentId: number, target: Vec2): { ok: boolean; message: string } {
    const resident = this.residents[residentId];
    if (!resident || resident.dimensionalState !== DimensionalState.OffPlane) return { ok: false, message: "Lift a citizen before choosing a destination." };
    if (wallCollision(target, collisionRadius(resident), this.world.walls)) return { ok: false, message: "The destination overlaps a planar boundary." };
    return this.completeReinsert(resident, target);
  }

  private completeReinsert(resident: ResidentState, target: Vec2): { ok: boolean; message: string } {
    resident.position = { ...target };
    resident.altitude = 0;
    resident.dimensionalState = DimensionalState.OnPlane;
    resident.descent = undefined;
    resident.memories.push({ type: "reinserted", tick: this.tick, position: { ...target }, confidence: 0.95 });
    resident.scheduleKey = `${this.day}-seek-exit`;
    resident.goal = "seek-exit";
    resident.destinationBuildingId = null;
    resident.destinationName = "Abbott Square";
    resident.intent = "Seeking a comprehensible route after reappearing";
    const square = this.world.publicPlaces.find((place) => place.id === "abbott-square")!;
    const anchor = square.anchors[resident.id % square.anchors.length];
    resident.destinationAnchorId = anchor.id;
    resident.route = findPath(this.world, resident.position, anchor.position, collisionRadius(resident));
    resident.routeIndex = 0;
    resident.routeTopologyVersion = this.world.topologyVersion;
    resident.routeStatus = resident.route.length ? "routing" : "blocked";
    resident.motionState = resident.route.length ? "moving" : "blocked";
    resident.routeStartDistance = this.routeDistance(resident);
    resident.lastRouteDistance = resident.routeStartDistance;
    resident.action = resident.route.length ? "Travel" : "Stranded";
    resident.blockedEventSent = false;
    if (resident.controller === "player") {
      resident.route = [];
      resident.routeIndex = 0;
      resident.routeStatus = "idle";
      resident.motionState = "controlled";
      resident.action = "PlayerControlled";
      resident.intent = "Waiting for your input";
      resident.destinationBuildingId = null;
      resident.destinationAnchorId = null;
      resident.destinationName = "Your chosen path";
      resident.blockedReason = null;
    }
    if (resident.controller !== "player" && !resident.route.length) this.emitRouteBlocked(resident);
    this.emit("dimensional", `${resident.name} returns within a boundary no Flatlander saw them cross.`, [resident.id], target);
    return resident.controller === "player"
      ? { ok: true, message: `${resident.name} has returned under your control.` }
      : { ok: true, message: resident.route.length ? `${resident.name} has returned and is seeking familiar streets.` : `${resident.name} has returned inside a region with no planar exit.` };
  }

  cutAt(target: Vec2): { ok: boolean; message: string } {
    const sealedWall = nearestWall(target, this.world.walls);
    if (sealedWall?.reopens) {
      this.captureTopologyUndo();
      const portal = {
        id: this.nextPortalId++,
        a: { ...sealedWall.a },
        b: { ...sealedWall.b },
        regionA: sealedWall.reopens.regionA,
        regionB: sealedWall.reopens.regionB,
        sourceWallId: sealedWall.reopens.sourceWallId
      };
      this.world = {
        ...this.world,
        walls: this.world.walls.filter((wall) => wall.id !== sealedWall.id),
        portals: [...this.world.portals, portal],
        topologyVersion: this.world.topologyVersion + 1
      };
      this.emit("intervention", "A sealed opening is restored exactly where it had been.", [], target, portal.regionB);
      this.replanAfterTopologyChange();
      return { ok: true, message: "The sealed opening has been reopened." };
    }
    const opening = createOpeningAt(target, this.world.walls, this.world.portals, this.nextPortalId++, EDITABLE_OPENING_WIDTH);
    if (!opening) return { ok: false, message: "No suitable boundary is close enough to cut." };
    this.captureTopologyUndo();
    this.world = { ...this.world, walls: opening.walls, portals: opening.portals, topologyVersion: this.world.topologyVersion + 1 };
    this.emit("intervention", "An opening appears where an unbroken boundary stood.", [], target);
    this.replanAfterTopologyChange();
    return { ok: true, message: "A new planar opening has been cut." };
  }

  sealAt(target: Vec2): { ok: boolean; message: string } {
    const portal = this.world.portals.reduce<(typeof this.world.portals)[number] | undefined>((best, candidate) => {
      const distance = distanceToSegment(target, candidate.a, candidate.b);
      return distance <= 7 && (!best || distance < distanceToSegment(target, best.a, best.b)) ? candidate : best;
    }, undefined);
    if (!portal) return { ok: false, message: "No opening is close enough to seal." };
    this.captureTopologyUndo();
    const nextWallId = Math.max(0, ...this.world.walls.map((wall) => wall.id)) + 1;
    this.world = {
      ...this.world,
      topologyVersion: this.world.topologyVersion + 1,
      portals: this.world.portals.filter((candidate) => candidate.id !== portal.id),
      walls: [...this.world.walls, {
        id: nextWallId,
        a: { ...portal.a },
        b: { ...portal.b },
        buildingId: portal.regionB,
        reopens: { regionA: portal.regionA, regionB: portal.regionB, sourceWallId: portal.sourceWallId }
      }]
    };
    this.emit("intervention", "A doorway closes into a continuous planar boundary.", [], target, portal.regionB);
    this.replanAfterTopologyChange();
    return { ok: true, message: "The opening has been sealed." };
  }

  resetPlane(): { ok: boolean; message: string } {
    this.captureTopologyUndo();
    this.world = {
      ...this.world,
      topologyVersion: this.world.topologyVersion + 1,
      walls: this.initialWalls.map((wall) => ({ ...wall, a: { ...wall.a }, b: { ...wall.b } })),
      portals: this.initialPortals.map((portal) => ({ ...portal, a: { ...portal.a }, b: { ...portal.b } }))
    };
    this.emit("intervention", "Every boundary and opening is restored to the town's original plan.", []);
    this.replanAfterTopologyChange();
    return { ok: true, message: "All plane changes have been reset." };
  }

  private replanAfterTopologyChange() {
    this.portalLeases.clear();
    this.portalQueues.clear();
    for (const resident of this.residents) {
      if (resident.controller === "player" || resident.dimensionalState !== DimensionalState.OnPlane) continue;
      if (resident.goal === "seek-exit") {
        const square = this.world.publicPlaces.find((place) => place.id === "abbott-square")!;
        const anchor = square.anchors[resident.id % square.anchors.length];
        resident.route = findPath(this.world, resident.position, anchor.position, collisionRadius(resident));
        resident.routeIndex = 0;
        resident.routeTopologyVersion = this.world.topologyVersion;
        resident.routeStatus = resident.route.length ? "routing" : "blocked";
        resident.motionState = resident.route.length ? "moving" : "blocked";
        resident.routeStartDistance = this.routeDistance(resident);
        resident.lastRouteDistance = resident.routeStartDistance;
        resident.action = resident.route.length ? "Travel" : "Stranded";
        if (resident.route.length) {
          resident.blockedEventSent = false;
          this.emit("route", `${resident.name} discovers that a planar route now exists.`, [resident.id], resident.position);
        }
      } else {
        const plan = this.schedulePlan(resident);
        this.applyPlan(resident, plan, true);
      }
    }
  }

  setClock(paused?: boolean, timeScale?: number) {
    if (paused !== undefined) this.paused = paused;
    if (timeScale !== undefined) {
      const requested = clamp(timeScale, 0.25, 16);
      if (this.residents.some((resident) => resident.controller === "player")) this.timeScaleBeforeControl = requested;
      else this.timeScale = requested;
    }
  }

  snapshot(): RenderSnapshot {
    const stride = 10;
    const data = new Float32Array(this.residents.length * stride);
    const telemetry: ResidentTelemetry[] = [];
    this.residents.forEach((resident, index) => {
      const offset = index * stride;
      data[offset] = resident.position.x;
      data[offset + 1] = resident.position.z;
      data[offset + 2] = resident.rotation;
      data[offset + 3] = resident.altitude;
      data[offset + 4] = resident.dimensionalState;
      data[offset + 5] = ACTION_CODE.get(resident.action) ?? 0;
      data[offset + 6] = resident.controller === "player" ? 1 : 0;
      data[offset + 7] = Math.hypot(resident.velocity.x, resident.velocity.z);
      data[offset + 8] = resident.velocity.x;
      data[offset + 9] = resident.velocity.z;
      const remaining = this.routeDistance(resident);
      telemetry.push({
        residentId: resident.id,
        action: resident.action,
        goal: resident.goal,
        destinationBuildingId: resident.destinationBuildingId,
        destinationName: resident.destinationName,
        intent: resident.intent,
        controller: resident.controller,
        routeStatus: resident.routeStatus,
        motionState: resident.motionState,
        routeProgress: resident.routeStartDistance > 0 ? clamp(1 - remaining / resident.routeStartDistance, 0, 1) : resident.routeStatus === "arrived" ? 1 : 0,
        waitSeconds: resident.waitSeconds,
        blockedReason: resident.blockedReason,
        waitingForResidentId: resident.waitingForResidentId,
        waitingVenueId: resident.waitingVenueId,
        velocity: { ...resident.velocity },
        needs: copyNeeds(resident.needs)
      });
    });
    return { tick: this.tick, timeMinutes: this.timeMinutes, day: this.day, stride, residentCount: this.residents.length, data, telemetry };
  }

  save(): WorldSaveV3 {
    return {
      version: 3,
      generatorVersion: 3,
      seed: this.world.seed,
      tick: this.tick,
      timeMinutes: this.timeMinutes,
      day: this.day,
      topologyVersion: this.world.topologyVersion,
      walls: this.world.walls,
      portals: this.world.portals,
      residents: this.residents.map((resident) => ({
        id: resident.id,
        name: resident.name,
        sides: resident.sides,
        radius: resident.radius,
        color: resident.color,
        rim: resident.rim,
        homeBuildingId: resident.homeBuildingId,
        workplaceId: resident.workplaceId,
        homeSlot: resident.homeSlot,
        workSlot: resident.workSlot,
        role: resident.role,
        scheduleTemplate: resident.scheduleTemplate,
        position: { ...resident.position },
        rotation: resident.rotation,
        altitude: resident.dimensionalState === DimensionalState.BeingReinserted ? 0 : resident.altitude,
        dimensionalState: resident.dimensionalState === DimensionalState.BeingReinserted ? DimensionalState.OnPlane : resident.dimensionalState,
        action: resident.action,
        goal: resident.goal,
        destinationBuildingId: resident.destinationBuildingId,
        destinationAnchorId: resident.destinationAnchorId,
        dwellUntilMinute: resident.dwellUntilMinute,
        controller: resident.controller,
        needs: copyNeeds(resident.needs),
        institutionalStatus: resident.institutionalStatus,
        higherDimensionBelief: resident.higherDimensionBelief,
        memories: resident.memories.map((memory) => ({ ...memory, position: { ...memory.position } }))
      })),
      events: this.events.slice(-120)
    };
  }

  load(save: WorldSaveV2 | WorldSaveV3) {
    this.initialize(save.seed);
    this.tick = save.tick;
    this.timeMinutes = save.timeMinutes;
    this.day = save.day;
    const repairedTopology = repairBoundaryTopology(save.walls, save.portals, this.world.buildings);
    this.world = {
      ...this.world,
      topologyVersion: save.topologyVersion + (repairedTopology.changed ? 1 : 0),
      walls: repairedTopology.walls,
      portals: repairedTopology.portals
    };
    this.reservations.clear();
    this.venueQueues.clear();
    this.portalQueues.clear();
    this.portalLeases.clear();
    this.residents = save.residents.slice(0, MAX_ACTIVE_RESIDENTS).map((resident) => ({
      ...resident,
      controller: "ai" as ControllerKind,
      position: { ...resident.position },
      needs: copyNeeds(resident.needs),
      memories: resident.memories.map((memory) => ({ ...memory, position: { ...memory.position } })),
      velocity: { x: 0, z: 0 },
      route: [],
      routeIndex: 0,
      routeTopologyVersion: this.world.topologyVersion,
      routeStatus: "blocked",
      input: { mode: "world", move: { x: 0, z: 0 }, sprint: false, sequence: 0, receivedTick: this.tick, sentAt: 0 },
      scheduleKey: "",
      intent: "Rejoining the remembered daily routine",
      destinationName: this.venue(resident.destinationBuildingId)?.name ?? "Town streets",
      reservationId: null,
      stuckSeconds: 0,
      routeStartDistance: 0,
      lastRouteDistance: Number.POSITIVE_INFINITY,
      replanAttempts: 0,
      motionState: "blocked",
      waitSeconds: 0,
      blockedReason: "Rejoining the remembered daily routine.",
      waitingForResidentId: null,
      waitingVenueId: null,
      retryAtMinute: 0,
      lastClearPosition: { ...resident.position },
      playerBlockedSeconds: 0,
      routeWorkerStop: 0,
      blockedEventSent: false
    }));
    this.events = save.events;
    this.eventId = Math.max(0, ...save.events.map((event) => event.id)) + 1;
    this.nextPortalId = Math.max(0, ...this.world.portals.map((portal) => portal.id)) + 1;
    this.residents.forEach((resident) => {
      if (resident.controller === "ai") this.applyPlan(resident, this.schedulePlan(resident), true);
    });
    this.emit("world", "A remembered town settles back onto the plane.", []);
  }

  private emit(type: SimEvent["type"], summary: string, actors: number[], position?: Vec2, venueId?: number) {
    this.events.push({
      id: this.eventId++,
      tick: this.tick,
      day: this.day,
      timeMinutes: this.timeMinutes,
      type,
      summary,
      actors,
      position: position ? { ...position } : undefined,
      venueId
    });
    if (this.events.length > 160) this.events.splice(0, this.events.length - 160);
  }
}
