import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmDialogProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  eyebrow = "Please confirm",
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onClose
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => cancel.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const target = previousFocus.current;
      requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    if (!focusable.length) return;
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
        className="confirm-dialog parchment-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
          <button type="button" aria-label="Close confirmation" onClick={onClose}><X /></button>
        </div>
        <div className="confirm-dialog__body">
          {destructive && <AlertTriangle aria-hidden="true" />}
          <div>{children}</div>
        </div>
        <div className="dialog-actions">
          <button ref={cancel} type="button" className="button-quiet" onClick={onClose}>{cancelLabel}</button>
          <button type="button" className={destructive ? "button-danger" : "button-primary"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
