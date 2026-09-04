import type {
  ActivityAnchor,
  EntranceMetadata,
  Portal,
  PublicPlace,
  ResidentStatic,
  ScheduleTemplate,
  Surface,
  Vec2,
  Venue,
  VenueKind,
  Wall,
  WorldStatic
} from "../types";

type Rng = () => number;
type DoorSide = Venue["doorSide"];

function mulberry32(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  "Aster Bell", "Beatrice Cairn", "Celia Dale", "Dorian Eames", "Edith Farrow",
  "Felix Grove", "Grace Hart", "Hector Ivory", "Iris Judd", "Julian Keene",
  "Kit Lark", "Lydia March", "Mabel North", "Nathaniel Orme", "Opal Pike",
  "Percival Quill", "Quinn Reed", "Rosamund Shaw", "Soren Abbott", "Theodora Vale"
];

const COLORS = ["#a84f42", "#376b7e", "#d49432", "#4f795d", "#805b82", "#b8673d", "#5e7698", "#77743f"];
const SIDE_CHOICES = [3, 4, 5, 6, 8, 12] as const;

function outsideDoor(center: Vec2, size: Vec2, side: DoorSide, distance = 2.1): Vec2 {
  if (side === "north") return { x: center.x, z: center.z - size.z / 2 - distance };
  if (side === "south") return { x: center.x, z: center.z + size.z / 2 + distance };
  if (side === "east") return { x: center.x + size.x / 2 + distance, z: center.z };
  return { x: center.x - size.x / 2 - distance, z: center.z };
}

function doorFacing(side: DoorSide) {
  return side === "north" ? Math.PI : side === "south" ? 0 : side === "east" ? Math.PI / 2 : -Math.PI / 2;
}

function entranceFor(id: number, center: Vec2, size: Vec2, side: DoorSide): EntranceMetadata {
  const outwardNormal = side === "north"
    ? { x: 0, z: -1 }
    : side === "south"
      ? { x: 0, z: 1 }
      : side === "east"
        ? { x: 1, z: 0 }
        : { x: -1, z: 0 };
  const tangent = { x: -outwardNormal.z, z: outwardNormal.x };
  const centerPoint = outsideDoor(center, size, side, 0);
  const queueDirection = id % 2 === 0 ? 1 : -1;
  const queueBase = {
    x: centerPoint.x + outwardNormal.x * 3,
    z: centerPoint.z + outwardNormal.z * 3
  };
  return {
    portalId: null,
    center: centerPoint,
    outwardNormal,
    tangent,
    outsideStage: {
      x: centerPoint.x + outwardNormal.x * 2,
      z: centerPoint.z + outwardNormal.z * 2
    },
    insideStage: {
      x: centerPoint.x - outwardNormal.x * 1.75,
      z: centerPoint.z - outwardNormal.z * 1.75
    },
    corridorHalfWidth: 1.5,
    queueSlots: Array.from({ length: 8 }, (_, index) => ({
      x: queueBase.x + tangent.x * queueDirection * (3.1 + index * 2.78),
      z: queueBase.z + tangent.z * queueDirection * (3.1 + index * 2.78)
    }))
  };
}

function makeAnchors(
  id: number,
  center: Vec2,
  size: Vec2,
  side: DoorSide,
  kind: VenueKind,
  staffCapacity: number,
  visitorCapacity: number
): ActivityAnchor[] {
  const anchors: ActivityAnchor[] = [];
  const facing = doorFacing(side);
  const tangentHalf = (side === "north" || side === "south" ? size.x : size.z) / 2;
  const normalHalf = (side === "north" || side === "south" ? size.z : size.x) / 2;
  const far = Math.max(2.55, tangentHalf - 1.35);
  const near = Math.max(1.25, far - 2.65);
  const tangentOffsets = [-far, -near, near, far];
  const normalOffsets = [-normalHalf + 1.45, 0, normalHalf - 1.45];
  const tangent = side === "north" || side === "south" ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const inward = side === "north"
    ? { x: 0, z: 1 }
    : side === "south"
      ? { x: 0, z: -1 }
      : side === "east"
        ? { x: -1, z: 0 }
        : { x: 1, z: 0 };
  const points: Vec2[] = [];
  for (const normalOffset of normalOffsets) {
    for (const tangentOffset of tangentOffsets) {
      points.push({
        x: center.x + tangent.x * tangentOffset + inward.x * normalOffset,
        z: center.z + tangent.z * tangentOffset + inward.z * normalOffset
      });
    }
  }
  if (kind === "home") {
    points.slice(0, 3).forEach((position, index) => anchors.push({ id: `${id}-home-${index}`, kind: "home", position, facing }));
  } else {
    points.slice(0, staffCapacity).forEach((position, index) => anchors.push({ id: `${id}-staff-${index}`, kind: "staff", position, facing }));
    points.slice(staffCapacity, staffCapacity + visitorCapacity).forEach((position, index) => anchors.push({ id: `${id}-visitor-${index}`, kind: "visitor", position, facing }));
  }
  const entrance = entranceFor(id, center, size, side);
  entrance.queueSlots.forEach((position, index) => anchors.push({ id: `${id}-queue-${index}`, kind: "queue", position, facing }));
  return anchors;
}

function addRect(
  walls: Wall[],
  portals: Portal[],
  venue: Venue,
  nextWallId: () => number,
  nextPortalId: () => number
) {
  const { x, z } = venue.center;
  const halfX = venue.size.x / 2;
  const halfZ = venue.size.z / 2;
  const left = x - halfX;
  const right = x + halfX;
  const top = z - halfZ;
  const bottom = z + halfZ;
  const doorWidth = venue.kind === "home" ? 3.4 : 4.4;
  const doorHalf = doorWidth / 2;
  const wall = (a: Vec2, b: Vec2) => walls.push({
    id: nextWallId(),
    a,
    b,
    buildingId: venue.regionId,
    heritage: venue.kind !== "home",
    materialId: venue.materialId
  });
  const addPortal = (a: Vec2, b: Vec2) => {
    const id = nextPortalId();
    portals.push({ id, a, b, regionA: 0, regionB: venue.regionId });
    venue.entrancePortalIds.push(id);
    venue.entrance.portalId = id;
  };

  const splitHorizontal = (edgeZ: number, isDoor: boolean) => {
    if (!isDoor || venue.sealed) return wall({ x: left, z: edgeZ }, { x: right, z: edgeZ });
    wall({ x: left, z: edgeZ }, { x: x - doorHalf, z: edgeZ });
    wall({ x: x + doorHalf, z: edgeZ }, { x: right, z: edgeZ });
    addPortal({ x: x - doorHalf, z: edgeZ }, { x: x + doorHalf, z: edgeZ });
  };
  const splitVertical = (edgeX: number, isDoor: boolean) => {
    if (!isDoor || venue.sealed) return wall({ x: edgeX, z: top }, { x: edgeX, z: bottom });
    wall({ x: edgeX, z: top }, { x: edgeX, z: z - doorHalf });
    wall({ x: edgeX, z: z + doorHalf }, { x: edgeX, z: bottom });
    addPortal({ x: edgeX, z: z - doorHalf }, { x: edgeX, z: z + doorHalf });
  };

  splitHorizontal(top, venue.doorSide === "north");
  splitHorizontal(bottom, venue.doorSide === "south");
  splitVertical(left, venue.doorSide === "west");
  splitVertical(right, venue.doorSide === "east");
}

function placeAnchors(id: PublicPlace["id"], center: Vec2, capacity: number): ActivityAnchor[] {
  return Array.from({ length: capacity }, (_, index) => {
    const angle = (index / capacity) * Math.PI * 2;
    const ring = index % 3 === 0 ? 2.6 : 5.2;
    return {
      id: `${id}-${index}`,
      kind: "visitor" as const,
      position: { x: center.x + Math.cos(angle) * ring, z: center.z + Math.sin(angle) * ring },
      facing: angle + Math.PI
    };
  });
}

export function buildWorld(seed = 1884): { world: WorldStatic; residents: ResidentStatic[]; spawnPoints: Vec2[] } {
  const random = mulberry32(seed);
  let wallId = 1;
  let portalId = 1;
  let buildingId = 1;
  const walls: Wall[] = [];
  const portals: Portal[] = [];
  const buildings: Venue[] = [];
  const surfaces: Surface[] = [
    { id: "plane", center: { x: 0, z: 0 }, size: { x: 136, z: 104 }, kind: "plane", materialId: "parchment", color: "#d6c39b", pathWeight: 1.35 },
    { id: "market-street", center: { x: 0, z: 0 }, size: { x: 124, z: 8 }, kind: "road", materialId: "road", color: "#596266", pathWeight: 0.8 },
    { id: "abbott-way", center: { x: 0, z: 0 }, size: { x: 8, z: 92 }, kind: "road", materialId: "road", color: "#596266", pathWeight: 0.8 },
    { id: "north-lane", center: { x: 0, z: -31 }, size: { x: 112, z: 7 }, kind: "road", materialId: "road", color: "#596266", pathWeight: 0.82 },
    { id: "south-lane", center: { x: 0, z: 31 }, size: { x: 112, z: 7 }, kind: "road", materialId: "road", color: "#596266", pathWeight: 0.82 },
    { id: "west-lane", center: { x: -48, z: 0 }, size: { x: 7, z: 69 }, kind: "road", materialId: "road", color: "#596266", pathWeight: 0.82 },
    { id: "east-lane", center: { x: 48, z: 0 }, size: { x: 7, z: 69 }, kind: "road", materialId: "road", color: "#596266", pathWeight: 0.82 },
    { id: "abbott-square", center: { x: 0, z: 0 }, size: { x: 28, z: 18 }, kind: "square", materialId: "civic-stone", color: "#a99d7d", pathWeight: 0.9 },
    { id: "west-common", center: { x: -28, z: 0 }, size: { x: 18, z: 7 }, kind: "garden", materialId: "garden", color: "#70804e", pathWeight: 1 },
    { id: "east-garden", center: { x: 28, z: 0 }, size: { x: 18, z: 7 }, kind: "garden", materialId: "garden", color: "#70804e", pathWeight: 1 }
  ];

  const addVenue = (
    name: string,
    shortName: string,
    kind: VenueKind,
    district: Venue["district"],
    center: Vec2,
    size: Vec2,
    doorSide: DoorSide,
    materialId: string,
    staffCapacity: number,
    visitorCapacity: number,
    openMinute: number,
    closeMinute: number,
    sealed = false
  ) => {
    const id = buildingId++;
    const venue: Venue = {
      id,
      regionId: id,
      name,
      shortName,
      kind,
      district,
      center,
      size,
      doorSide,
      materialId,
      entrancePortalIds: [],
      entrance: entranceFor(id, center, size, doorSide),
      anchors: makeAnchors(id, center, size, doorSide, kind, staffCapacity, visitorCapacity),
      staffCapacity,
      visitorCapacity,
      openMinute,
      closeMinute,
      sealed
    };
    buildings.push(venue);
    surfaces.push({ id: `building-${id}`, center, size, kind: "building", materialId, color: kind === "home" ? "#b9654a" : "#3f716b", pathWeight: 1.08 });
    addRect(walls, portals, venue, () => wallId++, () => portalId++);
    return venue;
  };

  const homes: Venue[] = [];
  for (const x of [-58, -42, 42, 58]) homes.push(addVenue(`North Court House ${homes.length + 1}`, `House ${homes.length + 1}`, "home", "residential", { x, z: -42 }, { x: 11, z: 8 }, "south", "domestic", 0, 0, 0, 1440));
  for (const x of [-58, -42, 42, 58]) homes.push(addVenue(`South Court House ${homes.length + 1}`, `House ${homes.length + 1}`, "home", "residential", { x, z: 42 }, { x: 11, z: 8 }, "north", "domestic", 0, 0, 0, 1440));
  for (const z of [-17, 17]) homes.push(addVenue(`West Court House ${homes.length + 1}`, `House ${homes.length + 1}`, "home", "residential", { x: -59, z }, { x: 10, z: 9 }, "east", "domestic", 0, 0, 0, 1440));
  for (const z of [-17, 17]) homes.push(addVenue(`East Court House ${homes.length + 1}`, `House ${homes.length + 1}`, "home", "residential", { x: 59, z }, { x: 10, z: 9 }, "west", "domestic", 0, 0, 0, 1440));

  const grocery = addVenue("Bell & Cairn Grocery", "Grocery", "grocery", "market", { x: -38, z: -18 }, { x: 14, z: 10 }, "south", "commerce", 3, 5, 420, 1140);
  const restaurant = addVenue("The Compass Tea Room", "Tea Room", "restaurant", "market", { x: -21, z: -18 }, { x: 14, z: 10 }, "south", "commerce", 4, 7, 660, 1290);
  const archive = addVenue("Abbott Archive & Library", "Archive", "archive", "services", { x: 12, z: -18 }, { x: 13, z: 10 }, "south", "services", 2, 4, 480, 1080);
  const school = addVenue("School of Practical Geometry", "School", "school", "services", { x: 28, z: -18 }, { x: 14, z: 10 }, "south", "services", 2, 6, 480, 990);
  const clinic = addVenue("Cairn Street Clinic", "Clinic", "clinic", "services", { x: 42, z: -18 }, { x: 10, z: 10 }, "south", "services", 2, 2, 450, 1020);
  const printworks = addVenue("Vale Pattern & Print Works", "Printworks", "printworks", "works", { x: -37, z: 18 }, { x: 14, z: 10 }, "north", "workshop", 4, 2, 450, 1020);
  const civic = addVenue("Civic Hall", "Civic Hall", "civic", "services", { x: -20, z: 18 }, { x: 14, z: 10 }, "north", "civic", 3, 6, 480, 1020);
  const research = addVenue("Institute of Measures", "Institute", "research", "works", { x: 15, z: 18 }, { x: 18, z: 12 }, "north", "civic", 2, 3, 480, 1080);
  const sealedRoom = addVenue("The Closed Room", "Closed Room", "sealed-room", "dimensional", { x: 36, z: 18 }, { x: 12, z: 12 }, "north", "civic", 0, 0, 0, 1440, true);

  const publicPlaces: PublicPlace[] = [
    { id: "abbott-square", name: "Abbott Square", center: { x: 0, z: 0 }, size: { x: 28, z: 18 }, capacity: 10, anchors: placeAnchors("abbott-square", { x: 0, z: 0 }, 10) },
    { id: "east-garden", name: "East Garden", center: { x: 28, z: 0 }, size: { x: 18, z: 7 }, capacity: 8, anchors: placeAnchors("east-garden", { x: 28, z: 0 }, 8) },
    { id: "west-common", name: "West Common", center: { x: -28, z: 0 }, size: { x: 18, z: 7 }, capacity: 8, anchors: placeAnchors("west-common", { x: -28, z: 0 }, 8) }
  ];

  const assignments: Array<{ workplace: Venue; role: string; schedule: ScheduleTemplate }> = [
    { workplace: grocery, role: "grocer", schedule: "early-service" },
    { workplace: grocery, role: "stock keeper", schedule: "early-service" },
    { workplace: restaurant, role: "tea-room host", schedule: "restaurant" },
    { workplace: restaurant, role: "cook", schedule: "restaurant" },
    { workplace: restaurant, role: "server", schedule: "restaurant" },
    { workplace: printworks, role: "printer", schedule: "day-worker" },
    { workplace: printworks, role: "engraver", schedule: "day-worker" },
    { workplace: printworks, role: "compositor", schedule: "day-worker" },
    { workplace: school, role: "teacher", schedule: "day-worker" },
    { workplace: school, role: "tutor", schedule: "day-worker" },
    { workplace: clinic, role: "physician", schedule: "civic-split" },
    { workplace: clinic, role: "clinic assistant", schedule: "civic-split" },
    { workplace: civic, role: "civic clerk", schedule: "civic-split" },
    { workplace: civic, role: "registrar", schedule: "civic-split" },
    { workplace: archive, role: "archivist", schedule: "day-worker" },
    { workplace: archive, role: "copyist", schedule: "day-worker" },
    { workplace: research, role: "researcher", schedule: "day-worker" },
    { workplace: research, role: "instrument maker", schedule: "day-worker" },
    { workplace: printworks, role: "courier-surveyor", schedule: "route-worker" },
    { workplace: civic, role: "groundskeeper", schedule: "route-worker" }
  ];

  const workCounts = new Map<number, number>();
  const residents: ResidentStatic[] = assignments.map((assignment, id) => {
    const sides = SIDE_CHOICES[Math.floor(random() * SIDE_CHOICES.length)];
    const home = homes[Math.floor(id / 2)];
    const workSlot = workCounts.get(assignment.workplace.id) ?? 0;
    workCounts.set(assignment.workplace.id, workSlot + 1);
    return {
      id,
      name: NAMES[id],
      sides,
      radius: 0.72 + sides * 0.035,
      color: COLORS[(id + Math.floor(random() * COLORS.length)) % COLORS.length],
      rim: id % 9 === 0 ? "notched" : id % 4 === 0 ? "double" : "plain",
      homeBuildingId: home.id,
      workplaceId: assignment.workplace.id,
      homeSlot: id % 2,
      workSlot,
      role: assignment.role,
      scheduleTemplate: assignment.schedule
    };
  });

  const spawnPoints = residents.map((resident) => {
    const home = homes.find((candidate) => candidate.id === resident.homeBuildingId)!;
    const homeAnchor = home.anchors.filter((anchor) => anchor.kind === "home")[resident.homeSlot];
    const workplace = buildings.find((candidate) => candidate.id === resident.workplaceId)!;
    const staffAnchor = workplace.anchors.filter((anchor) => anchor.kind === "staff")[resident.workSlot];
    if (resident.scheduleTemplate === "early-service" && staffAnchor) return { ...staffAnchor.position };
    return { ...homeAnchor.position };
  });
  spawnPoints[18] = outsideDoor(printworks.center, printworks.size, printworks.doorSide, 4.5);

  return {
    world: {
      seed,
      generatorVersion: 3,
      topologyVersion: 1,
      bounds: { minX: -68, maxX: 68, minZ: -52, maxZ: 52 },
      walls,
      portals,
      surfaces,
      buildings,
      publicPlaces,
      sealedRoomId: sealedRoom.id,
      groceryId: grocery.id,
      restaurantId: restaurant.id,
      printworksId: printworks.id,
      cartouche: {
        title: "FLATLAND",
        subtitle: "A ROMANCE OF MANY DIMENSIONS",
        author: "EDWIN A. ABBOTT",
        publication: "FIRST PUBLISHED 1884"
      }
    },
    residents,
    spawnPoints
  };
}
