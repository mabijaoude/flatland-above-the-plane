import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PeopleDirectory,
  type PeopleDirectoryResident
} from "./PeopleDirectory";
import {
  GUIDED_VISIT_STEPS,
  GuidedVisit,
  type GuidedVisitStepId
} from "./GuidedVisit";

const residents: PeopleDirectoryResident[] = [
  {
    id: 0,
    name: "Opal Pike",
    sides: 4,
    role: "Archivist",
    intent: "Opening the morning register",
    destination: "Town Archive",
    state: "Working"
  },
  {
    id: 1,
    name: "Soren Abbott",
    sides: 6,
    role: "Physician",
    intent: "Visiting a patient",
    destination: "West Clinic",
    state: "Travelling",
    pickUpUnavailableReason: "Soren is above the plane."
  }
];

function renderDirectory(initialQuery = "") {
  return renderToStaticMarkup(
    <PeopleDirectory
      residents={residents}
      activeResidentId={0}
      followedResidentId={0}
      controlledResidentId={1}
      initialQuery={initialQuery}
      createUnavailableReason="Return to the plane first."
      onLocate={vi.fn()}
      onFollow={vi.fn()}
      onPickUp={vi.fn()}
      onCreateCitizen={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

describe("PeopleDirectory", () => {
  it("renders an accessible non-modal directory with live resident context", () => {
    const html = renderDirectory();

    expect(html).toContain("<aside");
    expect(html).toContain('aria-labelledby=');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-modal="true"');
    expect(html).toContain('type="search"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Opal Pike");
    expect(html).toContain("4 sides · Archivist");
    expect(html).toContain("Opening the morning register");
    expect(html).toContain("Town Archive");
    expect(html).toContain("Working");
  });

  it("marks the citizen in view, followed citizen, and controlled citizen independently", () => {
    const html = renderDirectory();

    expect(html).toContain("people-directory__row is-active is-followed");
    expect(html).toContain("people-directory__row is-controlled");
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('aria-label="Stop following Opal Pike"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("In view");
    expect(html).toContain("Following");
    expect(html).toContain("In control");
  });

  it("filters its initial result set across resident details", () => {
    const html = renderDirectory("clinic");

    expect(html).not.toContain("Opal Pike");
    expect(html).toContain("Soren Abbott");
    expect(html).toContain("1 of 2 citizens shown.");
  });

  it("keeps unavailable actions focusable and exposes their reasons inline", () => {
    const html = renderDirectory();

    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Pick up unavailable: Soren is above the plane.");
    expect(html).toContain("Create unavailable: Return to the plane first.");
    expect(html).not.toContain("<button disabled");
    expect(html).toContain("Locate");
    expect(html).toContain("Follow");
    expect(html).toContain("Pick up");
    expect(html).toContain("Create a citizen");
  });
});

function renderVisit(step: GuidedVisitStepId) {
  return renderToStaticMarkup(
    <GuidedVisit
      step={step}
      primaryAction={{ label: "Continue", onAction: vi.fn() }}
      secondaryAction={{ label: "Go back", onAction: vi.fn() }}
      onSkip={vi.fn()}
      onReplay={vi.fn()}
    />
  );
}

describe("GuidedVisit", () => {
  it("provides typed copy for every step in the public tour sequence", () => {
    for (const definition of GUIDED_VISIT_STEPS) {
      const html = renderVisit(definition.id);
      expect(html).toContain(`data-step="${definition.id}"`);
      expect(html).toContain(definition.title);
      expect(html).toContain(definition.description);
      expect(html).toContain(definition.cue);
      expect(html).toContain("Continue");
      expect(html).toContain("Go back");
    }
  });

  it("announces in-progress steps and keeps them skippable", () => {
    const html = renderVisit("native");

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Guided visit, step 4 of 6: Native vision.");
    expect(html).toContain("Skip visit");
    expect(html).not.toContain("Replay visit");
  });

  it("announces completion and offers replay", () => {
    const html = renderVisit("complete");

    expect(html).toContain("Guided visit complete.");
    expect(html).toContain("Replay visit");
    expect(html).not.toContain("Skip visit");
  });

  it("exposes pending supplied actions without removing them from focus order", () => {
    const html = renderToStaticMarkup(
      <GuidedVisit
        step="plane-preview"
        primaryAction={{ label: "Open boundary", onAction: vi.fn(), pending: true }}
        onSkip={vi.fn()}
        onReplay={vi.fn()}
      />
    );

    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Open boundary…");
    expect(html).not.toContain("<button disabled");
  });
});
