import { useEffect, useId, useRef } from "react";

export type GuidedVisitStepId =
  | "survey"
  | "people"
  | "follow"
  | "native"
  | "plane-preview"
  | "undo"
  | "complete";

export type GuidedVisitStep = {
  id: GuidedVisitStepId;
  label: string;
  title: string;
  description: string;
  cue: string;
};

export type GuidedVisitAction = {
  label: string;
  onAction: () => void;
  disabled?: boolean;
  pending?: boolean;
  ariaLabel?: string;
};

export type GuidedVisitProps = {
  step: GuidedVisitStepId;
  primaryAction: GuidedVisitAction;
  secondaryAction?: GuidedVisitAction;
  onSkip: () => void;
  onReplay: () => void;
};

export const GUIDED_VISIT_STEPS: readonly GuidedVisitStep[] = [
  {
    id: "survey",
    label: "Town view",
    title: "Start above the town",
    description: "Town view shows the whole plane. Pan, orbit, and choose where to look.",
    cue: "Frame the town, then continue."
  },
  {
    id: "people",
    label: "Find citizen",
    title: "Find a citizen to follow",
    description: "Find citizen compares the shapes in town by role, present intent, and destination.",
    cue: "Open Find citizen and choose a shape."
  },
  {
    id: "follow",
    label: "Follow",
    title: "Watch a real routine",
    description: "Follow travels with a citizen without interrupting their day.",
    cue: "Follow the highlighted citizen."
  },
  {
    id: "native",
    label: "Native vision",
    title: "See without an overview",
    description: "Native vision shows boundaries as a Flatlander encounters them.",
    cue: "Enter Native vision, then return above."
  },
  {
    id: "plane-preview",
    label: "Edit walls",
    title: "Open a boundary",
    description: "Every edge carries its own action: remove a wall or add one across an opening.",
    cue: "Remove the highlighted wall. Undo will restore it."
  },
  {
    id: "undo",
    label: "Undo",
    title: "Restore the plane",
    description: "Undo removes the guided change and returns the town to its prior shape.",
    cue: "Undo the change, then return to the town view."
  },
  {
    id: "complete",
    label: "Complete",
    title: "Ready to explore",
    description: "Follow, pick up, direct, or edit the plane whenever curiosity calls.",
    cue: "The full town is yours to explore."
  }
];

const VISIT_STEP_COUNT = GUIDED_VISIT_STEPS.length - 1;

function ActionButton({
  action,
  className
}: {
  action: GuidedVisitAction;
  className: string;
}) {
  const unavailable = Boolean(action.disabled || action.pending);
  return (
    <button
      type="button"
      className={className}
      aria-label={action.ariaLabel}
      aria-disabled={unavailable || undefined}
      aria-busy={action.pending || undefined}
      onClick={() => {
        if (!unavailable) action.onAction();
      }}
    >
      {action.label}{action.pending ? "…" : ""}
    </button>
  );
}

export function GuidedVisit({
  step,
  primaryAction,
  secondaryAction,
  onSkip,
  onReplay
}: GuidedVisitProps) {
  const container = useRef<HTMLElement>(null);
  const componentId = useId();
  const titleId = `${componentId}-title`;
  const descriptionId = `${componentId}-description`;
  const definition = GUIDED_VISIT_STEPS.find((candidate) => candidate.id === step)!;
  const stepIndex = GUIDED_VISIT_STEPS.findIndex((candidate) => candidate.id === step);
  const complete = step === "complete";
  const progress = complete
    ? "Guided visit complete."
    : `Guided visit, step ${stepIndex + 1} of ${VISIT_STEP_COUNT}: ${definition.label}.`;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      container.current?.querySelector<HTMLButtonElement>(".guided-visit__primary")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  return (
    <section
      ref={container}
      className={`guided-visit parchment-panel is-${step}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-step={step}
    >
      <header className="guided-visit__header">
        <div>
          <p className="eyebrow">Guided visit</p>
          <p className="guided-visit__progress" role="status" aria-live="polite" aria-atomic="true">
            {progress}
          </p>
        </div>
        {complete ? (
          <button type="button" className="guided-visit__replay" onClick={onReplay}>
            Replay visit
          </button>
        ) : (
          <button type="button" className="guided-visit__skip" onClick={onSkip}>
            Skip visit
          </button>
        )}
      </header>

      <h2 id={titleId}>{definition.title}</h2>
      <p id={descriptionId} className="guided-visit__description">{definition.description}</p>
      <p className="guided-visit__cue">{definition.cue}</p>

      <div className="guided-visit__actions">
        {secondaryAction && <ActionButton action={secondaryAction} className="guided-visit__secondary" />}
        <ActionButton action={primaryAction} className="guided-visit__primary" />
      </div>
    </section>
  );
}
