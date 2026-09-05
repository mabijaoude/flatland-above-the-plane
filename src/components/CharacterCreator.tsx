import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ResidentProfile } from "../types";

const SHAPES = [3, 4, 5, 6, 8, 12] as const;
const EDGES: Array<{ value: ResidentProfile["rim"]; label: string }> = [
  { value: "plain", label: "Plain" },
  { value: "double", label: "Double" },
  { value: "notched", label: "Notched" }
];

export function CharacterCreator({
  onCreate,
  onClose,
  error,
  pending = false,
  avoidInitialInputFocus = false
}: {
  onCreate: (profile: ResidentProfile) => void;
  onClose: () => void;
  error?: string;
  pending?: boolean;
  avoidInitialInputFocus?: boolean;
}) {
  const [name, setName] = useState("A New Observer");
  const [sides, setSides] = useState<(typeof SHAPES)[number]>(5);
  const [color, setColor] = useState("#376b7e");
  const [rim, setRim] = useState<ResidentProfile["rim"]>("double");
  const dialog = useRef<HTMLFormElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const avoidInputFocusOnMount = useRef(
    avoidInitialInputFocus || (typeof window !== "undefined" && window.matchMedia("(any-pointer: coarse)").matches)
  );

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      if (!avoidInputFocusOnMount.current) nameInput.current?.focus();
      else dialog.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      const target = previousFocus.current;
      requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    };
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!pending) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>("button, input, select, [tabindex]:not([tabindex='-1'])") ?? [])].filter((element) => !element.hasAttribute("disabled"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || pending) return;
    onCreate({ name: trimmedName, sides, color, rim });
  };

  return (
    <div className="dialog-scrim" role="presentation" onPointerDown={() => { if (!pending) onClose(); }}>
      <form
        ref={dialog}
        className="character-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-title"
        aria-busy={pending}
        tabIndex={-1}
        onSubmit={submit}
        onKeyDown={trapFocus}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Registry of persons</p>
        <h2 id="character-title">Create a citizen</h2>
        <p>The registry will assign a real home and an available occupation. Geometry affects passage, never worth or ability.</p>
        <label>Name<input ref={nameInput} value={name} maxLength={32} enterKeyHint="done" autoComplete="off" disabled={pending} onChange={(event) => setName(event.target.value)} /></label>
        <fieldset disabled={pending}>
          <legend>Geometry</legend>
          <div className="shape-options">
            {SHAPES.map((count) => <button type="button" aria-pressed={sides === count} className={sides === count ? "is-selected" : ""} key={count} onClick={() => setSides(count)}>
              <svg className="shape-option-preview" viewBox="0 0 32 32" aria-hidden="true">
                <polygon points={Array.from({ length: count }, (_, index) => {
                  const angle = index * Math.PI * 2 / count - Math.PI / 2;
                  return `${16 + 12 * Math.cos(angle)},${16 + 12 * Math.sin(angle)}`;
                }).join(" ")} />
              </svg>
              {count}<span>sides</span>
            </button>)}
          </div>
        </fieldset>
        <div className="form-pair">
          <label>Ink<input type="color" value={color} disabled={pending} onChange={(event) => setColor(event.target.value)} /></label>
          <fieldset className="edge-fieldset" disabled={pending}>
            <legend>Edge</legend>
            <div className="edge-options">
              {EDGES.map((edge) => (
                <button
                  type="button"
                  key={edge.value}
                  aria-pressed={rim === edge.value}
                  className={rim === edge.value ? "is-selected" : ""}
                  onClick={() => setRim(edge.value)}
                >
                  {edge.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button-quiet" disabled={pending} onClick={onClose}>Cancel</button>
          <button type="submit" className="button-primary" disabled={pending || !name.trim()}>{pending ? "Entering…" : "Enter Flatland"}</button>
        </div>
      </form>
    </div>
  );
}
