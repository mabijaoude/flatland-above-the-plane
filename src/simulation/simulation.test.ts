import { describe, expect, it } from "vitest";
import { DimensionalState, type ResidentProfile } from "../types";
import { regionAtPoint } from "./navigation";
import { FlatworldSimulation } from "./simulation";

const guest: ResidentProfile = { name: "Ada Plane", sides: 5, color: "#6f5c8c", rim: "double" };

describe("living Flatworld simulation", () => {
  it("starts a compact, assigned society with purposeful destinations", () => {
    const simulation = new FlatworldSimulation(1884);
    const statics = simulation.getResidentStatics();
    const snapshot = simulation.snapshot();
    expect(statics).toHaveLength(20);
    expect(new Set(statics.map((resident) => resident.name)).size).toBe(20);
    expect(snapshot.telemetry.every((resident) => resident.intent.length > 12)).toBe(true);
    expect(snapshot.telemetry.every((resident) => resident.destinationName !== "Town streets")).toBe(true);
    expect(snapshot.telemetry.filter((resident) => resident.routeStatus === "blocked")).toHaveLength(0);

    for (const resident of statics) {
      const home = simulation.world.buildings.find((venue) => venue.id === resident.homeBuildingId)!;
      const work = simulation.world.buildings.find((venue) => venue.id === resident.workplaceId)!;
      expect(home.kind).toBe("home");
      expect(home.anchors.filter((anchor) => anchor.kind === "home")[resident.homeSlot]).toBeDefined();
      expect(work.anchors.filter((anchor) => anchor.kind === "staff")[resident.workSlot]).toBeDefined();
    }
  });

  it("advances resident activity deterministically and produces visible travel", () => {
    const first = new FlatworldSimulation(1884);
    const second = new FlatworldSimulation(1884);
    const before = first.snapshot();
    for (let tick = 0; tick < 180; tick += 1) {
      first.step();
      second.step();
    }
    const after = first.snapshot();
    expect(Array.from(after.data)).toEqual(Array.from(second.snapshot().data));
    const distances = Array.from({ length: after.residentCount }, (_, id) => {
      const offset = id * after.stride;
      return Math.hypot(after.data[offset] - before.data[offset], after.data[offset + 1] - before.data[offset + 1]);
    });
    expect(Math.max(...distances)).toBeGreaterThan(2);
    expect(first.timeMinutes).toBeGreaterThan(500);
  });

  it("keeps follow semantics separate from explicit player control", () => {
    const simulation = new FlatworldSimulation(1884);
    const id = 18;
    const before = simulation.snapshot();
    expect(simulation.beginControl(id).ok).toBe(true);
    for (let tick = 0; tick < 20; tick += 1) simulation.step();
    const waiting = simulation.snapshot();
    expect(waiting.telemetry[id].controller).toBe("player");
    expect(waiting.telemetry[id].action).toBe("PlayerControlled");
    expect(waiting.data[id * waiting.stride]).toBeCloseTo(before.data[id * before.stride], 4);
    expect(waiting.data[id * waiting.stride + 1]).toBeCloseTo(before.data[id * before.stride + 1], 4);

    expect(simulation.setInput(id, { x: 1, z: 0.45 }, true, 1, 0)).toBe(true);
    for (let tick = 0; tick < 75; tick += 1) simulation.step();
    const moved = simulation.snapshot();
    expect(Math.hypot(
      moved.data[id * moved.stride] - waiting.data[id * waiting.stride],
      moved.data[id * moved.stride + 1] - waiting.data[id * waiting.stride + 1]
    )).toBeGreaterThan(1);
    expect(simulation.endControl(id, true).ok).toBe(true);
    const released = simulation.snapshot().telemetry[id];
    expect(released.controller).toBe("ai");
    expect(released.motionState).not.toBe("controlled");
    expect(released.action).not.toBe("PlayerControlled");
  });

  it("moves a controlled citizen responsively and noticeably faster at brisk pace", () => {
    const walking = new FlatworldSimulation(1884);
    const brisk = new FlatworldSimulation(1884);
    const id = 18;
    expect(walking.lift(id).ok).toBe(true);
    expect(brisk.lift(id).ok).toBe(true);
    expect(walking.reinsert(id, { x: 0, z: 0 }).ok).toBe(true);
    expect(brisk.reinsert(id, { x: 0, z: 0 }).ok).toBe(true);
    const start = walking.snapshot();
    expect(walking.beginControl(id).ok).toBe(true);
    expect(brisk.beginControl(id).ok).toBe(true);
    for (let tick = 0; tick < 30; tick += 1) {
      if (tick % 8 === 0) {
        expect(walking.setInput(id, { x: 0, z: -1 }, false, tick + 1, tick)).toBe(true);
        expect(brisk.setInput(id, { x: 0, z: -1 }, true, tick + 1, tick)).toBe(true);
      }
      walking.step();
      brisk.step();
    }
    const walked = walking.snapshot();
    const hurried = brisk.snapshot();
    const startX = start.data[id * start.stride];
    const startZ = start.data[id * start.stride + 1];
    const walkingDistance = Math.hypot(walked.data[id * walked.stride] - startX, walked.data[id * walked.stride + 1] - startZ);
    const briskDistance = Math.hypot(hurried.data[id * hurried.stride] - startX, hurried.data[id * hurried.stride + 1] - startZ);

    expect(walkingDistance).toBeGreaterThan(3.2);
    expect(briskDistance).toBeGreaterThan(walkingDistance * 1.35);
  });

  it("uses forward-and-turn steering without detaching native vision from the citizen heading", () => {
    const simulation = new FlatworldSimulation(1884);
    const id = 18;
    expect(simulation.beginControl(id).ok).toBe(true);
    const beforeTurn = simulation.snapshot();
    const offset = id * beforeTurn.stride;

    expect(simulation.setSteeringInput(id, 0, 1, false, 1, 0)).toBe(true);
    for (let tick = 0; tick < 12; tick += 1) simulation.step();
    const afterTurn = simulation.snapshot();
    expect(afterTurn.data[offset + 2] - beforeTurn.data[offset + 2]).toBeGreaterThan(0.7);
    expect(Math.hypot(afterTurn.data[offset] - beforeTurn.data[offset], afterTurn.data[offset + 1] - beforeTurn.data[offset + 1])).toBeLessThan(0.02);

    expect(simulation.setSteeringInput(id, 1, 0, false, 2, 0)).toBe(true);
    for (let tick = 0; tick < 12; tick += 1) simulation.step();
    const afterForward = simulation.snapshot();
    const dx = afterForward.data[offset] - afterTurn.data[offset];
    const dz = afterForward.data[offset + 1] - afterTurn.data[offset + 1];
    const distance = Math.hypot(dx, dz);
    const heading = afterForward.data[offset + 2];
    expect(distance).toBeGreaterThan(0.3);
    expect((dx * Math.sin(heading) + dz * Math.cos(heading)) / distance).toBeGreaterThan(0.9);
  });

  it("strands a reinserted citizen in the Closed Room until topology changes", () => {
    const simulation = new FlatworldSimulation(1884);
    const id = 4;
    const room = simulation.world.buildings.find((venue) => venue.id === simulation.world.sealedRoomId)!;
    expect(simulation.lift(id).ok).toBe(true);
    let snapshot = simulation.snapshot();
    expect(snapshot.data[id * snapshot.stride + 4]).toBe(DimensionalState.OffPlane);
    expect(simulation.moveLifted(id, { x: room.center.x - 2, z: room.center.z + 1 }, 9)).toBe(true);
    snapshot = simulation.snapshot();
    expect(snapshot.data[id * snapshot.stride]).toBeCloseTo(room.center.x - 2);
    expect(snapshot.data[id * snapshot.stride + 1]).toBeCloseTo(room.center.z + 1);
    expect(snapshot.data[id * snapshot.stride + 3]).toBeCloseTo(9);
    expect(simulation.reinsert(id, room.center).message).toContain("no planar exit");
    snapshot = simulation.snapshot();
    expect(snapshot.telemetry[id].goal).toBe("seek-exit");
    expect(snapshot.telemetry[id].routeStatus).toBe("blocked");

    expect(simulation.cutAt({ x: room.center.x, z: room.center.z + room.size.z / 2 }).ok).toBe(true);
    expect(simulation.snapshot().telemetry[id].routeStatus).toBe("routing");
  });

  it("uses a newly cut Tea Room exit after the original doorway is sealed", () => {
    const simulation = new FlatworldSimulation(1884);
    const teaRoom = simulation.world.buildings.find((venue) => venue.id === simulation.world.restaurantId)!;
    const originalPortal = simulation.world.portals.find((portal) => (
      portal.regionA === teaRoom.regionId || portal.regionB === teaRoom.regionId
    ))!;
    const originalDoor = {
      x: (originalPortal.a.x + originalPortal.b.x) / 2,
      z: (originalPortal.a.z + originalPortal.b.z) / 2
    };
    const oppositeWall = {
      x: teaRoom.center.x * 2 - originalDoor.x,
      z: teaRoom.center.z * 2 - originalDoor.z
    };

    expect(simulation.sealAt(originalDoor).ok).toBe(true);
    expect(simulation.cutAt(oppositeWall).ok).toBe(true);

    const residentId = 4;
    expect(simulation.lift(residentId).ok).toBe(true);
    expect(simulation.reinsert(residentId, teaRoom.center).ok).toBe(true);
    expect(simulation.snapshot().telemetry[residentId].routeStatus).toBe("routing");

    let escaped = false;
    for (let tick = 0; tick < 600; tick += 1) {
      simulation.step();
      const snapshot = simulation.snapshot();
      const offset = residentId * snapshot.stride;
      if (regionAtPoint(simulation.world, { x: snapshot.data[offset], z: snapshot.data[offset + 1] }) === 0) {
        escaped = true;
        break;
      }
    }
    expect(escaped).toBe(true);
  });

  it("animates a dropped citizen back to the plane even while the town clock is paused", () => {
    const simulation = new FlatworldSimulation(1884);
    const id = 4;
    expect(simulation.lift(id).ok).toBe(true);
    expect(simulation.moveLifted(id, { x: 0, z: 0 }, 9)).toBe(true);
    expect(simulation.drop(id).ok).toBe(true);

    let snapshot = simulation.snapshot();
    const offset = id * snapshot.stride;
    expect(snapshot.data[offset + 4]).toBe(DimensionalState.BeingReinserted);
    expect(snapshot.data[offset + 3]).toBeCloseTo(9);
    expect(simulation.moveLifted(id, { x: 2, z: 2 }, 12)).toBe(false);

    simulation.setClock(true);
    simulation.step(0.5);
    snapshot = simulation.snapshot();
    expect(snapshot.data[offset + 3]).toBeLessThan(9);
    expect(snapshot.data[offset + 3]).toBeGreaterThan(0);
    expect(snapshot.data[offset + 4]).toBe(DimensionalState.BeingReinserted);

    simulation.step(2);
    snapshot = simulation.snapshot();
    expect(snapshot.data[offset + 3]).toBe(0);
    expect(snapshot.data[offset + 4]).toBe(DimensionalState.OnPlane);
    expect(simulation.takeCompletedDrops()).toEqual([
      expect.objectContaining({ residentId: id, message: expect.stringContaining("returned") })
    ]);
    expect(simulation.takeCompletedDrops()).toEqual([]);
  });

  it("persists a safe landed state if a save is requested during the fall", () => {
    const simulation = new FlatworldSimulation(1884);
    const id = 4;
    expect(simulation.lift(id).ok).toBe(true);
    expect(simulation.drop(id).ok).toBe(true);

    const saved = simulation.save().residents[id];
    expect(saved.altitude).toBe(0);
    expect(saved.dimensionalState).toBe(DimensionalState.OnPlane);
  });

  it("preserves player control while lifting and after dropping a citizen", () => {
    const simulation = new FlatworldSimulation(1884);
    const id = 18;
    expect(simulation.beginControl(id).ok).toBe(true);
    expect(simulation.lift(id).ok).toBe(true);
    expect(simulation.snapshot().telemetry[id].controller).toBe("player");

    const target = { x: 0, z: 0 };
    expect(simulation.reinsert(id, target).ok).toBe(true);
    const returned = simulation.snapshot().telemetry[id];
    expect(returned.controller).toBe("player");
    expect(returned.motionState).toBe("controlled");
    expect(returned.action).toBe("PlayerControlled");
  });

  it("undoes the latest topology intervention", () => {
    const simulation = new FlatworldSimulation(1884);
    const beforeWalls = simulation.world.walls.length;
    const room = simulation.world.buildings.find((venue) => venue.id === simulation.world.sealedRoomId)!;
    expect(simulation.cutAt({ x: room.center.x, z: room.center.z + room.size.z / 2 }).ok).toBe(true);
    expect(simulation.world.walls.length).not.toBe(beforeWalls);
    expect(simulation.undoIntervention().ok).toBe(true);
    expect(simulation.world.walls.length).toBe(beforeWalls);
    expect(simulation.undoIntervention().ok).toBe(false);
  });

  it("keeps plane undo scoped to walls after citizens are moved", () => {
    const simulation = new FlatworldSimulation(1884);
    const originalWalls = structuredClone(simulation.world.walls);
    const room = simulation.world.buildings.find((venue) => venue.id === simulation.world.sealedRoomId)!;
    expect(simulation.cutAt({ x: room.center.x, z: room.center.z + room.size.z / 2 }).ok).toBe(true);

    expect(simulation.lift(0).ok).toBe(true);
    expect(simulation.reinsert(0, { x: 0, z: 0 }).ok).toBe(true);
    expect(simulation.undoIntervention().ok).toBe(true);

    expect(simulation.world.walls).toEqual(originalWalls);
    const snapshot = simulation.snapshot();
    expect(snapshot.data[0]).toBeCloseTo(0);
    expect(snapshot.data[1]).toBeCloseTo(0);
  });

  it("reopens an opening after it has been sealed", () => {
    const simulation = new FlatworldSimulation(1884);
    const room = simulation.world.buildings.find((venue) => venue.id === simulation.world.sealedRoomId)!;
    const target = { x: room.center.x, z: room.center.z + room.size.z / 2 };

    expect(simulation.cutAt(target).ok).toBe(true);
    const openPortalCount = simulation.world.portals.length;
    expect(simulation.sealAt(target).ok).toBe(true);
    expect(simulation.world.walls.some((wall) => wall.reopens?.regionB === room.id)).toBe(true);

    const reopened = simulation.cutAt(target);
    expect(reopened.ok, reopened.message).toBe(true);
    expect(reopened.message).toContain("reopened");
    expect(simulation.world.portals).toHaveLength(openPortalCount);
    expect(simulation.world.walls.some((wall) => wall.reopens?.regionB === room.id)).toBe(false);
  });

  it("resets every plane change and can undo that reset", () => {
    const simulation = new FlatworldSimulation(1884);
    const originalWalls = structuredClone(simulation.world.walls);
    const originalPortals = structuredClone(simulation.world.portals);
    const archive = simulation.world.buildings.find((venue) => venue.kind === "archive")!;
    const archivePortal = simulation.world.portals.find((portal) => portal.regionA === archive.id || portal.regionB === archive.id)!;
    const archiveOpening = {
      x: (archivePortal.a.x + archivePortal.b.x) / 2,
      z: (archivePortal.a.z + archivePortal.b.z) / 2
    };
    const closedRoom = simulation.world.buildings.find((venue) => venue.id === simulation.world.sealedRoomId)!;
    const closedRoomBoundary = { x: closedRoom.center.x, z: closedRoom.center.z + closedRoom.size.z / 2 };

    expect(simulation.sealAt(archiveOpening).ok).toBe(true);
    expect(simulation.cutAt(closedRoomBoundary).ok).toBe(true);
    expect(simulation.world.portals.some((portal) => portal.id === archivePortal.id)).toBe(false);
    expect(simulation.world.portals.some((portal) => portal.regionA === closedRoom.id || portal.regionB === closedRoom.id)).toBe(true);

    expect(simulation.resetPlane().ok).toBe(true);
    expect(simulation.world.walls).toEqual(originalWalls);
    expect(simulation.world.portals).toEqual(originalPortals);

    expect(simulation.undoIntervention().ok).toBe(true);
    expect(simulation.world.portals.some((portal) => portal.id === archivePortal.id)).toBe(false);
    expect(simulation.world.portals.some((portal) => portal.regionA === closedRoom.id || portal.regionB === closedRoom.id)).toBe(true);
  });

  it("admits exactly four created citizens into valid homes and jobs", () => {
    const simulation = new FlatworldSimulation(1884);
    for (let index = 0; index < 4; index += 1) {
      const result = simulation.createResident({ ...guest, name: `Guest ${index + 1}` });
      expect(result.ok, result.message).toBe(true);
    }
    expect(simulation.getResidentStatics()).toHaveLength(24);
    expect(simulation.createResident({ ...guest, name: "One Too Many" }).ok).toBe(false);
  });

  it("round-trips the mutable society through a V3 save and releases remembered control", () => {
    const simulation = new FlatworldSimulation(1884);
    simulation.step();
    simulation.lift(2);
    const save = simulation.save();
    const restored = new FlatworldSimulation(7);
    restored.load(save);
    expect(restored.tick).toBe(save.tick);
    expect(restored.residents[2].dimensionalState).toBe(DimensionalState.OffPlane);
    expect(restored.world.walls).toHaveLength(save.walls.length);
    expect(restored.snapshot().residentCount).toBe(save.residents.length);
    expect(restored.snapshot().telemetry.every((resident) => resident.controller === "ai")).toBe(true);
  });

  it("repairs overlapping wall and opening geometry while loading an older town", () => {
    const simulation = new FlatworldSimulation(1884);
    const save = structuredClone(simulation.save());
    const institute = simulation.world.buildings.find((venue) => venue.kind === "research")!;
    const originalPortal = save.portals.find((portal) => portal.regionB === institute.regionId)!;
    const overlapId = Math.max(...save.portals.map((portal) => portal.id)) + 1;
    const wallId = Math.max(...save.walls.map((wall) => wall.id)) + 1;
    save.portals.push({
      id: overlapId,
      a: { x: originalPortal.a.x - 1, z: originalPortal.a.z },
      b: { x: originalPortal.a.x + 1, z: originalPortal.a.z },
      regionA: originalPortal.regionA,
      regionB: originalPortal.regionB
    });
    save.walls.push({
      id: wallId,
      a: { x: originalPortal.a.x + 0.8, z: originalPortal.a.z },
      b: { x: originalPortal.a.x - 0.8, z: originalPortal.a.z },
      buildingId: institute.regionId
    });

    const restored = new FlatworldSimulation(7);
    restored.load(save);

    expect(restored.world.topologyVersion).toBe(save.topologyVersion + 1);
    expect(restored.world.portals).toHaveLength(save.portals.length - 1);
    expect(restored.world.walls.some((wall) => wall.id === wallId)).toBe(false);
  });

  it("keeps seed 1884 moving through lunch and evening without persistent penetration", () => {
    const simulation = new FlatworldSimulation(1884);
    let maximumPenetration = 0;
    let maximumUnexplainedStall = 0;
    while (simulation.timeMinutes < 20 * 60 + 30) {
      simulation.step();
      if (simulation.tick % 15 !== 0) continue;
      const snapshot = simulation.snapshot();
      const statics = simulation.getResidentStatics();
      for (let first = 0; first < snapshot.residentCount; first += 1) {
        for (let second = first + 1; second < snapshot.residentCount; second += 1) {
          const firstOffset = first * snapshot.stride;
          const secondOffset = second * snapshot.stride;
          if (snapshot.data[firstOffset + 4] !== DimensionalState.OnPlane || snapshot.data[secondOffset + 4] !== DimensionalState.OnPlane) continue;
          const distance = Math.hypot(snapshot.data[firstOffset] - snapshot.data[secondOffset], snapshot.data[firstOffset + 1] - snapshot.data[secondOffset + 1]);
          const minimum = (statics[first].radius + statics[second].radius) * 1.09;
          maximumPenetration = Math.max(maximumPenetration, minimum - distance);
        }
        if (snapshot.telemetry[first].motionState === "moving") maximumUnexplainedStall = Math.max(maximumUnexplainedStall, simulation.residents[first].stuckSeconds);
      }
    }
    expect(maximumPenetration).toBeLessThan(0.025);
    expect(maximumUnexplainedStall).toBeLessThan(3.1);
    expect(simulation.snapshot().telemetry.filter((resident) => resident.motionState === "blocked").length).toBeLessThan(3);
  }, 30000);

  it("advances equivalent simulated motion at 1x and 16x", () => {
    const normal = new FlatworldSimulation(1884);
    const accelerated = new FlatworldSimulation(1884);
    accelerated.setClock(undefined, 16);
    for (let step = 0; step < 960; step += 1) normal.step();
    for (let step = 0; step < 60; step += 1) accelerated.step();
    expect(accelerated.timeMinutes).toBeCloseTo(normal.timeMinutes, 4);
    const normalSnapshot = normal.snapshot();
    const acceleratedSnapshot = accelerated.snapshot();
    expect(Array.from(acceleratedSnapshot.data)).toEqual(Array.from(normalSnapshot.data));
    expect(acceleratedSnapshot.telemetry.map((resident) => resident.destinationName)).toEqual(normalSnapshot.telemetry.map((resident) => resident.destinationName));
  }, 20000);
});
