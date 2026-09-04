import { ArrowRight } from "lucide-react";

type WelcomeDialogProps = {
  hasSavedTown: boolean;
  onContinue: () => void;
  onStartNewTown: () => void;
  onStartGuidedTour: () => void;
  onReadBook: () => void;
  onOpenAnalogy: () => void;
};

export function WelcomeDialog({
  hasSavedTown,
  onContinue,
  onStartNewTown,
  onStartGuidedTour,
  onReadBook,
  onOpenAnalogy
}: WelcomeDialogProps) {
  return (
    <div className="intro-scrim">
      <section
        className="intro-card parchment-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flatworld-welcome-title"
        aria-describedby="flatworld-welcome-description"
      >
        <p className="eyebrow">Welcome to Flatland</p>
        <h1 id="flatworld-welcome-title">See Flatland from above.</h1>
        <p id="flatworld-welcome-description" className="intro-lead">
          This project takes inspiration from Edwin A. Abbott&apos;s{" "}
          <button type="button" className="intro-inline-link" onClick={onReadBook}>
            <cite>Flatland</cite>
          </button>
          . Explore a two-dimensional town, then use height to cross a sealed boundary without passing through its walls.
        </p>

        <div className="intro-cues" aria-label="What you can explore">
          <span>A 2D world</span>
          <span>A 3D intervention</span>
          <span>A 4D analogy</span>
        </div>
        <button type="button" className="intro-analogy-link" onClick={onOpenAnalogy}>
          Read more about this analogy <ArrowRight aria-hidden="true" />
        </button>

        <div className="intro-actions" aria-label="Choose how to begin">
          <button
            id="flatworld-intro-primary"
            autoFocus
            className="button-primary"
            onClick={onContinue}
          >
            {hasSavedTown ? "Continue saved town" : "Explore freely"}
          </button>
          <button className="button-quiet" onClick={onStartGuidedTour}>Take the 90-second tour</button>
          {hasSavedTown && (
            <button className="intro-new-town" onClick={onStartNewTown}>Start a new town</button>
          )}
        </div>
      </section>
    </div>
  );
}
