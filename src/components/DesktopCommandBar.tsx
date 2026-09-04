import { CircleHelp } from "lucide-react";

export type DesktopCommand = {
  id: string;
  label: string;
  shortcut?: string;
  onActivate?: () => void;
  emphasis?: boolean;
  disabled?: boolean;
};

type DesktopCommandBarProps = {
  title: string;
  hint: string;
  commands: readonly DesktopCommand[];
  hasSidePanel: boolean;
  onOpenHelp: () => void;
};

export function DesktopCommandBar({
  title,
  hint,
  commands,
  hasSidePanel,
  onOpenHelp
}: DesktopCommandBarProps) {
  return (
    <aside
      className={`desktop-command-bar ${hasSidePanel ? "has-side-panel" : ""}`}
      aria-label="Current controls"
    >
      <div className="desktop-command-bar__context">
        <strong>{title}</strong>
        <span>{hint}</span>
      </div>
      <div className="desktop-command-bar__commands">
        {commands.map((command) => command.onActivate ? (
          <button
            key={command.id}
            type="button"
            className={command.emphasis ? "is-primary" : ""}
            disabled={command.disabled}
            onClick={command.onActivate}
          >
            {command.shortcut && <kbd>{command.shortcut}</kbd>}
            <span>{command.label}</span>
          </button>
        ) : (
          <span key={command.id} className="desktop-command-bar__key">
            {command.shortcut && <kbd>{command.shortcut}</kbd>}
            <span>{command.label}</span>
          </span>
        ))}
      </div>
      <button type="button" className="desktop-command-bar__help" onClick={onOpenHelp} aria-label="Open all controls">
        <CircleHelp aria-hidden="true" />
        <span>All controls</span>
      </button>
    </aside>
  );
}
