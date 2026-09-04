import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CharacterCreator } from "./CharacterCreator";
import { CitizenActionPanel, citizenActionSheetSize, citizenActionStage, showCitizenActionDrawer, type CitizenActionStage } from "./CitizenActionPanel";
import { ControlsDialog } from "./ControlsDialog";
import { AdaptationContext } from "./AdaptationContext";
import { TouchJoystick } from "./TouchJoystick";
import { TownMenu, TOWN_MENU_SECTION_TITLES } from "./TownMenu";
import { DimensionalState, type ResidentStatic } from "../types";
import { DesktopCommandBar } from "./DesktopCommandBar";
import { MobileFollowBar } from "./MobileFollowBar";

const resident: ResidentStatic = {
  id: 0,
  name: "Opal Pike",
  sides: 4,
  radius: 1,
  color: "#3f716b",
  rim: "plain",
  homeBuildingId: 0,
  workplaceId: 1,
  homeSlot: 0,
  workSlot: 0,
  role: "Archivist",
  scheduleTemplate: "day-worker"
};

function renderCitizenStage(stage: CitizenActionStage, falling = false, tool?: "none" | "carry" | "reinsert") {
  return renderToStaticMarkup(
    <CitizenActionPanel
      resident={resident}
      residents={[resident]}
      stage={stage}
      summary="Travelling to the Archive."
      destination="Archive"
      dimensionalState={stage === "carry" ? DimensionalState.OffPlane : DimensionalState.OnPlane}
      followed={false}
      camera="chase"
      tool={tool ?? (stage === "carry" ? "carry" : "none")}
      releasePending={false}
      falling={falling}
      onSelect={vi.fn()}
      onFollow={vi.fn()}
      onStopFollowing={vi.fn()}
      onTakeControl={vi.fn()}
      onOpenCreator={vi.fn()}
      onSetCamera={vi.fn()}
      onRecover={vi.fn()}
      onPickUp={vi.fn()}
      onRelease={vi.fn()}
      onDrop={vi.fn()}
      showDropAction
      onTogglePlacement={vi.fn()}
    />
  );
}

describe("control surfaces", () => {
  it("renders the citizen creator as one modal form with a guarded pending state", () => {
    const html = renderToStaticMarkup(
      <CharacterCreator onCreate={vi.fn()} onClose={vi.fn()} pending />
    );

    expect(html).toContain("<form");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('type="submit"');
    expect(html).toContain("Entering");
    expect(html).toContain("disabled");
  });

  it("describes mouse, touch, keyboard, and tool-centre controls in the help dialog", () => {
    const html = renderToStaticMarkup(<ControlsDialog onClose={vi.fn()} />);

    expect(html).toContain('aria-labelledby="controls-title"');
    expect(html).toContain("Left-drag pans");
    expect(html).toContain("Phone &amp; tablet");
    expect(html).toContain("WASD moves");
    expect(html).toContain("The locked-room experiment");
    expect(html).toContain("F follows or stops following");
    expect(html).toContain("E picks them up");
    expect(html).toContain("C starts or stops direct control");
    expect(html).toContain("Choose exact spot lets you click a green map target");
    expect(html).toContain("T starts editing");
    expect(html).toContain("red Remove wall or green Add wall button");
    expect(html).toContain("Their view and Stop remain visible");
    expect(html).toContain("Undo, Reset, and Done stay in the bottom bar");
    expect(html).not.toContain("1 chooses Open");
    expect(html).toContain("Escape");
  });

  it("shows context-sensitive desktop commands instead of static mode instructions", () => {
    const html = renderToStaticMarkup(
      <DesktopCommandBar
        title="Opal Pike"
        hint="4 sides · Archivist"
        commands={[
          { id: "pickup", label: "Pick up", shortcut: "E", onActivate: vi.fn(), emphasis: true },
          { id: "follow", label: "Follow", shortcut: "F", onActivate: vi.fn() }
        ]}
        hasSidePanel
        onOpenHelp={vi.fn()}
      />
    );

    expect(html).toContain('aria-label="Current controls"');
    expect(html).toContain("has-side-panel");
    expect(html).toContain(">E</kbd>");
    expect(html).toContain("Pick up");
    expect(html).toContain(">F</kbd>");
    expect(html).toContain("All controls");
  });

  it("keeps source context optional while clearly separating the book from the project", () => {
    const html = renderToStaticMarkup(
      <AdaptationContext onClose={vi.fn()} onReadBook={vi.fn()} />
    );

    expect(html).toContain('id="flatland-adaptation-context"');
    expect(html).toContain("The locked-room analogy");
    expect(html).toContain(">2D<");
    expect(html).toContain(">3D<");
    expect(html).toContain(">4D<");
    expect(html).toContain("The same enclosure, different degrees of freedom");
    expect(html).toContain("Every route out meets the wall");
    expect(html).toContain("A third spatial dimension provides another path");
    expect(html).toContain("not simulated");
    expect(html).toContain("not evidence that such visitors exist");
    expect(html).toContain("What this simulation models");
    expect(html).toContain("Project choices");
    expect(html).toContain("Read section 17");
    expect(html).toContain("Read section 19");
    expect(html).toContain("does not reproduce or endorse the source&#x27;s sex- and class-based hierarchy");
    expect(html).toContain("Return to Flatland");
    expect(html).toContain("Open the full book");
    expect(html.indexOf("Return to Flatland")).toBeLessThan(html.indexOf("Open the full book"));
  });

  it("exposes the virtual movement and flight controls to keyboard and assistive technology", () => {
    const html = renderToStaticMarkup(
      <TouchJoystick
        label="Lifted citizen controls"
        onInput={vi.fn()}
        onAltitudeInput={vi.fn()}
        onDrop={vi.fn()}
        onPrecisePlace={vi.fn()}
        precisePlaceActive
        precisePlaceLabel="Cancel exact"
      />
    );

    expect(html).toContain('aria-label="Lifted citizen controls"');
    expect(html).toContain('class="touch-controls is-flight"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-describedby=');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Brisk off"');
    expect(html).toContain(">Raise<");
    expect(html).toContain(">Lower<");
    expect(html).toContain('aria-label="Lifted citizen flight and placement controls"');
    expect(html).toContain("Place here");
    expect(html).toContain("Cancel exact");
    expect(html).toContain('class="touch-precise-place is-active"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("Place &amp; release");
  });

  it("keeps mobile carry actions on the map instead of in a second drawer", () => {
    expect(showCitizenActionDrawer(true, "carry")).toBe(false);
    expect(showCitizenActionDrawer(true, "direct")).toBe(false);
    expect(showCitizenActionDrawer(true, "choose")).toBe(true);
    expect(showCitizenActionDrawer(false, "carry")).toBe(true);
  });

  it("restores the complete citizen actions after placement", () => {
    expect(citizenActionSheetSize(true, false, false, false)).toBe("collapsed");
    expect(citizenActionSheetSize(false, true, false, true)).toBe("expanded");
    expect(citizenActionSheetSize(false, true, true, false)).toBe("expanded");
    expect(citizenActionSheetSize(false, false, false, true)).toBe("collapsed");
    expect(citizenActionSheetSize(false, false, false, false)).toBe("expanded");
  });

  it("places controlled-citizen actions beside the touch joystick", () => {
    const html = renderToStaticMarkup(
      <TouchJoystick
        label="Citizen touch controls"
        onInput={vi.fn()}
        onPickUp={vi.fn()}
        onView={vi.fn()}
        onRelease={vi.fn()}
      />
    );

    expect(html).toContain('class="touch-controls is-grounded"');
    expect(html).toContain('aria-label="Controlled citizen actions"');
    expect(html).toContain(">Pick up<");
    expect(html).toContain("Their view");
    expect(html).toContain("Stop control");
  });

  it("explains native steering as forward, back, and turn rather than screen-relative movement", () => {
    const html = renderToStaticMarkup(
      <TouchJoystick
        mode="steering"
        label="Native vision steering controls"
        moveLabel="Steer citizen"
        onInput={vi.fn()}
      />
    );

    expect(html).toContain('class="touch-controls is-steering"');
    expect(html).toContain("Drag up or down to move forward or back");
    expect(html).toContain(">Forward<");
    expect(html).toContain(">Turn<");
    expect(html).toContain(">Back<");
  });

  it("keeps the citizen workflow in one panel while its primary action advances", () => {
    const choose = renderCitizenStage("choose");
    const direct = renderCitizenStage("direct");
    const carry = renderCitizenStage("carry");

    expect(choose).toContain("Pick up");
    expect(choose).toContain('class="action-choice-grid action-citizen-actions"');
    expect(choose).toContain('aria-keyshortcuts="F"');
    expect(choose).toContain('aria-keyshortcuts="E"');
    expect(choose).toContain('aria-keyshortcuts="C"');
    expect(choose).toContain(">C</kbd>");
    expect(choose).not.toContain("action-direct-choice");
    expect(direct).toContain("Pick up");
    expect(direct).toContain("Stop control");
    expect(direct).toContain('aria-keyshortcuts="C"');
    expect(direct).not.toContain("Take control");
    expect(direct).not.toContain('aria-label="Current action stage"');
    expect(carry).toContain("Place here");
    expect(carry).toContain("Choose exact spot");
    expect(carry).toContain('aria-label="Current action stage"');
    expect(carry).not.toContain("Release");
  });

  it("makes the active precise-placement mode explicit and cancellable", () => {
    const precise = renderCitizenStage("carry", false, "reinsert");

    expect(precise).toContain("Choose a green spot");
    expect(precise).toContain("Use the map to place; Escape cancels.");
    expect(precise).toContain('aria-pressed="true"');
    expect(precise).toContain('aria-keyshortcuts="Escape"');
    expect(precise).toContain(">Esc</kbd>");
  });

  it("removes direct actions from the citizen panel when touch controls own them", () => {
    const html = renderToStaticMarkup(
      <CitizenActionPanel
        resident={resident}
        residents={[resident]}
        stage="direct"
        summary=""
        destination="Archive"
        dimensionalState={DimensionalState.OnPlane}
        followed={false}
        camera="chase"
        tool="none"
        releasePending={false}
        falling={false}
        onSelect={vi.fn()}
        onFollow={vi.fn()}
        onStopFollowing={vi.fn()}
        onTakeControl={vi.fn()}
        onOpenCreator={vi.fn()}
        onSetCamera={vi.fn()}
        onRecover={vi.fn()}
        onPickUp={vi.fn()}
        onRelease={vi.fn()}
        onDrop={vi.fn()}
        showDropAction={false}
        showDirectActions={false}
        onTogglePlacement={vi.fn()}
      />
    );

    expect(html).toContain("Native vision");
    expect(html).not.toContain('class="action-choice-grid action-primary-row"');
  });

  it("keeps touch selection focused on the citizen's immediate actions", () => {
    const html = renderToStaticMarkup(
      <CitizenActionPanel
        resident={resident}
        residents={[resident]}
        stage="choose"
        summary="Travelling to the Archive."
        destination="Archive"
        dimensionalState={DimensionalState.OnPlane}
        followed={false}
        camera="follow"
        tool="none"
        releasePending={false}
        falling={false}
        compactSelection
        onSelect={vi.fn()}
        onFollow={vi.fn()}
        onStopFollowing={vi.fn()}
        onTakeControl={vi.fn()}
        onOpenCreator={vi.fn()}
        onSetCamera={vi.fn()}
        onRecover={vi.fn()}
        onPickUp={vi.fn()}
        onRelease={vi.fn()}
        onDrop={vi.fn()}
        showDropAction={false}
        onTogglePlacement={vi.fn()}
      />
    );

    expect(html).toContain("Follow");
    expect(html).toContain("Pick up");
    expect(html).toContain("Control");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Create your citizen");
  });

  it("keeps the mobile follow state and its exit visible", () => {
    const html = renderToStaticMarkup(
      <MobileFollowBar
        resident={resident}
        onOpenActions={vi.fn()}
        onPickUp={vi.fn()}
        onNativeView={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(html).toContain('aria-label="Following Opal Pike"');
    expect(html).toContain('aria-label="Open actions for Opal Pike"');
    expect(html).toContain("Pick up");
    expect(html).toContain("View");
    expect(html).toContain("Stop");
  });

  it("turns the carry panel into a non-interactive return-to-plane status during a fall", () => {
    const falling = renderCitizenStage("carry", true);

    expect(falling).toContain("Opal Pike is falling");
    expect(falling).toContain("Returning");
    expect(falling).not.toContain("Drop here");
    expect(falling).not.toContain("Choose exact spot");
  });

  it("derives the action stage from the selected citizen relationship", () => {
    expect(citizenActionStage(2, null, null)).toBe("choose");
    expect(citizenActionStage(2, 2, null)).toBe("direct");
    expect(citizenActionStage(2, 2, 2)).toBe("carry");
  });

  it("groups the town menu by task with saves first and reference material last", () => {
    const html = renderToStaticMarkup(
      <TownMenu
        open
        introActive={false}
        hasSidePanel={false}
        mode="explore"
        projection="perspective"
        camera="survey"
        controlled={false}
        carrying={false}
        nativeViewAvailable={false}
        paused={false}
        timeScale={1}
        quality="auto"
        savedAt="2026-08-13T13:00:00.000Z"
        saveDirty={false}
        onClose={vi.fn()}
        onFrameTown={vi.fn()}
        onToggleProjection={vi.fn()}
        onSetCamera={vi.fn()}
        onTogglePaused={vi.fn()}
        onSetTimeScale={vi.fn()}
        onSetQuality={vi.fn()}
        onOpenGazette={vi.fn()}
        onReplayGuidedVisit={vi.fn()}
        onSave={vi.fn()}
        onRecall={vi.fn()}
        onStartNewTown={vi.fn()}
        onOpenHelp={vi.fn()}
        onOpenAbout={vi.fn()}
      />
    );

    expect(html).toContain('aria-labelledby="town-menu-title"');
    expect(html).toContain("Manage Flatland");
    expect(html).toContain("Save current town");
    expect(html).toContain("Restore saved town");
    expect(html).toContain("Start a new town");

    const sectionPositions = TOWN_MENU_SECTION_TITLES.map((title) => html.indexOf(title.replace("&", "&amp;")));
    expect(sectionPositions.every((position) => position >= 0)).toBe(true);
    expect(sectionPositions).toEqual([...sectionPositions].sort((a, b) => a - b));
    expect(html.indexOf("Save current town")).toBeLessThan(html.indexOf("Frame town"));
    expect(html.indexOf("Controls &amp; shortcuts")).toBeGreaterThan(html.indexOf("Guided visit"));
    expect(html.indexOf("Source &amp; context")).toBeGreaterThan(html.indexOf("Guided visit"));
  });
});
