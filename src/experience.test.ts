import { describe, expect, it } from "vitest";
import {
  cameraMode,
  controlledResidentId,
  experienceMode,
  experienceReducer,
  followedResidentId,
  initialExperienceState,
  interventionTool,
  primaryNavigationSection
} from "./experience";

describe("experience state invariants", () => {
  it("selects without changing observation or control", () => {
    expect(cameraMode(initialExperienceState)).toBe("survey");
    expect(followedResidentId(initialExperienceState)).toBeNull();
    expect(initialExperienceState.selectedResidentId).toBeNull();
    const selected = experienceReducer(initialExperienceState, { type: "select", residentId: 3 });
    expect(selected.selectedResidentId).toBe(3);
    expect(controlledResidentId(selected)).toBeNull();
    expect(followedResidentId(selected)).toBeNull();
  });

  it("makes follow and embodied control mutually exclusive", () => {
    const followed = experienceReducer(initialExperienceState, { type: "follow", residentId: 7 });
    expect(cameraMode(followed)).toBe("follow");
    expect(followedResidentId(followed)).toBe(7);
    expect(controlledResidentId(followed)).toBeNull();

    const controlled = experienceReducer(followed, { type: "begin-control", residentId: 7 });
    expect(experienceMode(controlled)).toBe("join");
    expect(cameraMode(controlled)).toBe("chase");
    expect(controlledResidentId(controlled)).toBe(7);
    expect(followedResidentId(controlled)).toBeNull();

    const released = experienceReducer(controlled, { type: "end-control" });
    expect(experienceMode(released)).toBe("explore");
    expect(cameraMode(released)).toBe("follow");
    expect(followedResidentId(released)).toBe(7);
  });

  it("rejects frame and projection changes while embodied", () => {
    const controlled = experienceReducer(initialExperienceState, { type: "begin-control", residentId: 7 });
    const framed = experienceReducer(controlled, { type: "frame-town" });
    const projected = experienceReducer(controlled, { type: "set-projection", projection: "orthographic" });
    expect(cameraMode(framed)).toBe("chase");
    expect(controlledResidentId(framed)).toBe(7);
    expect(projected.projection).toBe("perspective");
  });

  it("moves explicitly among embodied camera views", () => {
    const controlled = experienceReducer(initialExperienceState, { type: "begin-control", residentId: 7 });
    const native = experienceReducer(controlled, { type: "set-camera", cameraMode: "native" });
    const overhead = experienceReducer(native, { type: "set-camera", cameraMode: "overhead" });
    const guided = experienceReducer(overhead, { type: "set-camera", cameraMode: "chase" });

    expect(cameraMode(native)).toBe("native");
    expect(cameraMode(overhead)).toBe("overhead");
    expect(cameraMode(guided)).toBe("chase");
    expect(controlledResidentId(guided)).toBe(7);
  });

  it("keeps pickup and precise placement inside the active control relationship", () => {
    const controlled = experienceReducer(initialExperienceState, { type: "begin-control", residentId: 7 });
    const carrying = experienceReducer(controlled, { type: "set-tool", tool: "carry" });
    const positioning = experienceReducer(carrying, { type: "set-tool", tool: "reinsert" });
    const cancelled = experienceReducer(positioning, { type: "back" });
    const returned = experienceReducer(cancelled, { type: "set-tool", tool: "none" });

    expect(experienceMode(carrying)).toBe("join");
    expect(controlledResidentId(carrying)).toBe(7);
    expect(interventionTool(carrying)).toBe("carry");
    expect(controlledResidentId(positioning)).toBe(7);
    expect(interventionTool(positioning)).toBe("reinsert");
    expect(controlledResidentId(cancelled)).toBe(7);
    expect(interventionTool(cancelled)).toBe("carry");
    expect(cancelled.overlay).toBe("none");
    expect(controlledResidentId(returned)).toBe(7);
    expect(interventionTool(returned)).toBe("none");
  });

  it("supports precise placement after picking up an autonomous followed citizen", () => {
    const followed = experienceReducer(initialExperienceState, { type: "follow", residentId: 7 });
    const carrying = experienceReducer(followed, { type: "set-tool", tool: "carry" });
    const positioning = experienceReducer(carrying, { type: "set-tool", tool: "reinsert" });
    const cancelled = experienceReducer(positioning, { type: "back" });
    const returned = experienceReducer(cancelled, { type: "set-tool", tool: "none" });

    expect(controlledResidentId(carrying)).toBeNull();
    expect(followedResidentId(carrying)).toBe(7);
    expect(interventionTool(carrying)).toBe("carry");
    expect(interventionTool(positioning)).toBe("reinsert");
    expect(interventionTool(cancelled)).toBe("carry");
    expect(followedResidentId(cancelled)).toBe(7);
    expect(interventionTool(returned)).toBe("none");
  });

  it("closing Join always returns to a visible Explore state", () => {
    const joined = experienceReducer(initialExperienceState, { type: "set-mode", mode: "join" });
    const closed = experienceReducer(joined, { type: "close-join" });
    expect(experienceMode(closed)).toBe("explore");
    expect(cameraMode(closed)).toBe("survey");
  });

  it("supports passive Native vision while a citizen remains autonomous", () => {
    const followed = experienceReducer(initialExperienceState, { type: "follow", residentId: 2 });
    const native = experienceReducer(followed, { type: "set-camera", cameraMode: "native" });
    const returned = experienceReducer(native, { type: "back" });

    expect(cameraMode(native)).toBe("native");
    expect(controlledResidentId(native)).toBeNull();
    expect(followedResidentId(native)).toBe(2);
    expect(cameraMode(returned)).toBe("follow");
    expect(followedResidentId(returned)).toBe(2);
  });

  it("closes the top overlay before unwinding the current activity", () => {
    const followed = experienceReducer(initialExperienceState, { type: "follow", residentId: 4 });
    const withPeople = experienceReducer(followed, { type: "set-overlay", overlay: "people" });
    const overlayClosed = experienceReducer(withPeople, { type: "back" });
    const survey = experienceReducer(overlayClosed, { type: "back" });

    expect(overlayClosed.overlay).toBe("none");
    expect(cameraMode(overlayClosed)).toBe("follow");
    expect(cameraMode(survey)).toBe("survey");
    expect(followedResidentId(survey)).toBeNull();
  });

  it("starts and cancels the guided visit from a canonical Survey state", () => {
    const joined = experienceReducer(initialExperienceState, { type: "set-mode", mode: "intervene" });
    const touring = experienceReducer(joined, { type: "start-tour" });
    const cancelled = experienceReducer(touring, { type: "cancel-tour" });

    expect(touring.tourStep).toBe("survey");
    expect(experienceMode(touring)).toBe("explore");
    expect(cameraMode(touring)).toBe("survey");
    expect(touring.introActive).toBe(false);
    expect(cancelled.tourStep).toBe("idle");
    expect(cameraMode(cancelled)).toBe("survey");
  });

  it("keeps one stable primary navigation destination through each workflow", () => {
    expect(primaryNavigationSection(initialExperienceState)).toBe("survey");

    const people = experienceReducer(initialExperienceState, { type: "set-overlay", overlay: "people" });
    expect(primaryNavigationSection(people)).toBe("people");

    const selected = experienceReducer(initialExperienceState, { type: "select", residentId: 3 });
    expect(primaryNavigationSection(selected)).toBe("people");

    const plane = experienceReducer(initialExperienceState, { type: "set-mode", mode: "intervene" });
    expect(primaryNavigationSection(plane)).toBe("plane");

    const survey = experienceReducer(plane, { type: "set-mode", mode: "explore" });
    expect(primaryNavigationSection(survey)).toBe("survey");
  });
});
