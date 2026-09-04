import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { X } from "lucide-react";

type ControlsDialogProps = {
  onClose: () => void;
};

function focusableElements(container: HTMLElement | null) {
  return [...(container?.querySelectorAll<HTMLElement>(
    "button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])"
  ) ?? [])].filter((element) => !element.hasAttribute("disabled") && !element.hasAttribute("inert"));
}

export function ControlsDialog({ onClose }: ControlsDialogProps) {
  const dialog = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dialog.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const target = previousFocus.current;
      requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(dialog.current);
    if (!focusable.length) {
      event.preventDefault();
      dialog.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const closeFromScrim = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="dialog-scrim" role="presentation" onPointerDown={closeFromScrim}>
      <section
        ref={dialog}
        className="controls-dialog parchment-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="controls-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Controls</p>
            <h2 id="controls-title">Move through the plane</h2>
          </div>
          <button type="button" aria-label="Close controls" onClick={onClose}><X /></button>
        </div>
        <div className="controls-dialog__recipe">
          <p className="eyebrow">The locked-room experiment</p>
          <ol>
            <li><strong>Seal</strong> the room’s openings.</li>
            <li><strong>Pick up</strong> citizens and place them inside.</li>
            <li><strong>Open</strong> the boundary again.</li>
            <li><strong>Find and follow</strong> one citizen through the exit.</li>
          </ol>
        </div>
        <div className="controls-dialog__platforms">
          <section aria-labelledby="desktop-controls-title">
            <h3 id="desktop-controls-title">Desktop</h3>
            <dl>
              <div><dt>Look around</dt><dd>Left-drag pans, right-drag rotates, wheel zooms, and WASD moves the view. R recentres.</dd></div>
              <div><dt>Citizen</dt><dd>Click a citizen, then F follows or stops following, E picks them up, and C starts or stops direct control. Ctrl/⌘ K opens Find citizen.</dd></div>
              <div><dt>Carry</dt><dd>WASD moves, Q/E changes height, and Shift accelerates. Space places directly below; Choose exact spot lets you click a green map target.</dd></div>
              <div><dt>Edit walls</dt><dd>T starts editing. Hover a wall or opening, then use its red Remove wall or green Add wall button. Ctrl/⌘ Z undoes.</dd></div>
              <div><dt>View</dt><dd>V enters Native vision and O changes the survey projection. Escape steps back from the current view or action.</dd></div>
            </dl>
          </section>
          <section aria-labelledby="touch-controls-title">
            <h3 id="touch-controls-title">Phone &amp; tablet</h3>
            <dl>
              <div><dt>Look around</dt><dd>Drag the town to look and pinch to zoom. Use Find citizen when the streets become crowded.</dd></div>
              <div><dt>Citizen</dt><dd>Tap a citizen for Follow and Pick up. While following, Their view and Stop remain visible; tap the citizen’s name for more actions.</dd></div>
              <div><dt>Carry</dt><dd>Fly with the movement pad. Place here returns them below; Choose spot switches to the map, where one green tap places them.</dd></div>
              <div><dt>Edit walls</dt><dd>Open Edit walls, tap a wall or opening, then use the action beside it. Undo, Reset, and Done stay in the bottom bar.</dd></div>
            </dl>
          </section>
        </div>
        <p className="controls-dialog__escape">Escape or browser Back always steps out of the current action before leaving the world.</p>
        <button type="button" className="button-primary" onClick={onClose}>Return to Flatland</button>
      </section>
    </div>
  );
}
