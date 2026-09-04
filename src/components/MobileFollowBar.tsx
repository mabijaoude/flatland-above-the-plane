import { Box, Eye, ScanLine, Square } from "lucide-react";
import type { ResidentStatic } from "../types";

type MobileFollowBarProps = {
  resident: ResidentStatic;
  onOpenActions: () => void;
  onPickUp: () => void;
  onNativeView: () => void;
  onStop: () => void;
};

export function MobileFollowBar({
  resident,
  onOpenActions,
  onPickUp,
  onNativeView,
  onStop
}: MobileFollowBarProps) {
  return (
    <aside className="mobile-follow-bar parchment-panel" aria-label={`Following ${resident.name}`}>
      <button
        type="button"
        className="mobile-follow-bar__resident"
        aria-label={`Open actions for ${resident.name}`}
        onClick={onOpenActions}
      >
        <Eye aria-hidden="true" />
        <span><small>Following</small><strong>{resident.name}</strong></span>
      </button>
      <button type="button" className="mobile-follow-bar__pickup" onClick={onPickUp}>
        <Box aria-hidden="true" />
        <span>Pick up</span>
      </button>
      <button type="button" onClick={onNativeView}>
        <ScanLine aria-hidden="true" />
        <span>View</span>
      </button>
      <button type="button" className="mobile-follow-bar__stop" onClick={onStop}>
        <Square aria-hidden="true" />
        <span>Stop</span>
      </button>
    </aside>
  );
}
