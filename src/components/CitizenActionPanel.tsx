import {
  Box,
  CircleDot,
  Eye,
  Map,
  RotateCcw,
  ScanLine,
  UserRoundPlus
} from "lucide-react";
import type { InterventionTool } from "../experience";
import { DimensionalState, type CameraMode, type ResidentStatic } from "../types";

export type CitizenActionStage = "choose" | "direct" | "carry";

export function showCitizenActionDrawer(touchControlsEnabled: boolean, stage: CitizenActionStage) {
  return !touchControlsEnabled || (stage !== "direct" && stage !== "carry");
}

export function citizenActionSheetSize(
  isCarrying: boolean,
  justFinishedCarrying: boolean,
  isControlling: boolean,
  isFollowing: boolean
) {
  if (isCarrying) return "collapsed" as const;
  if (justFinishedCarrying) return "expanded" as const;
  return isControlling || isFollowing ? "collapsed" as const : "expanded" as const;
}

export function citizenActionStage(
  residentId: number,
  controlledId: number | null,
  carriedId: number | null
): CitizenActionStage {
  if (carriedId === residentId) return "carry";
  if (controlledId === residentId) return "direct";
  return "choose";
}

type CitizenActionPanelProps = {
  resident: ResidentStatic;
  residents: ResidentStatic[];
  stage: CitizenActionStage;
  summary: string;
  destination: string;
  dimensionalState: DimensionalState;
  followed: boolean;
  camera: CameraMode;
  tool: InterventionTool;
  blockedReason?: string;
  releasePending: boolean;
  falling: boolean;
  onSelect: (residentId: number) => void;
  onFollow: () => void;
  onStopFollowing: () => void;
  onTakeControl: () => void;
  onOpenCreator: () => void;
  onSetCamera: (camera: "chase" | "overhead" | "native") => void;
  onRecover: () => void;
  onPickUp: () => void;
  onRelease: () => void;
  onDrop: () => void;
  showDropAction: boolean;
  showDirectActions?: boolean;
  compactSelection?: boolean;
  onTogglePlacement: () => void;
};

export function CitizenActionPanel({
  resident,
  residents,
  stage,
  summary,
  destination,
  dimensionalState,
  followed,
  camera,
  tool,
  blockedReason,
  releasePending,
  falling,
  onSelect,
  onFollow,
  onStopFollowing,
  onTakeControl,
  onOpenCreator,
  onSetCamera,
  onRecover,
  onPickUp,
  onRelease,
  onDrop,
  showDropAction,
  showDirectActions = true,
  compactSelection = false,
  onTogglePlacement
}: CitizenActionPanelProps) {
  return (
    <div className="action-section citizen-action-panel" data-stage={stage}>
      {stage === "choose" && !compactSelection && (
        <label>
          Citizen
          <select value={resident.id} onChange={(event) => onSelect(Number(event.target.value))}>
            {residents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {candidate.role}
              </option>
            ))}
          </select>
        </label>
      )}

      {stage !== "carry" && (
        <p className="action-citizen-summary">
          <strong>{stage === "direct" ? "Their routine is paused while you control them." : summary}</strong>
          <span>{resident.sides} sides · {stage === "direct" ? resident.role : destination}</span>
        </p>
      )}

      {stage === "choose" && (
        <>
          <div className={`action-choice-grid action-citizen-actions${compactSelection ? " is-compact-selection" : ""}`}>
            <button className="join-choice" aria-keyshortcuts="F" onClick={followed ? onStopFollowing : onFollow}>
              <Eye />
              <span>{followed ? "Stop following" : "Follow"}<small>{followed ? "Return to the town view." : "Stay with their real routine."}</small></span>
              <kbd>F</kbd>
            </button>
            <button className="join-choice is-primary" aria-keyshortcuts="E" disabled={dimensionalState !== DimensionalState.OnPlane} onClick={onPickUp}>
              <Box />
              <span>Pick up<small>Lift them directly above the plane.</small></span>
              <kbd>E</kbd>
            </button>
            <button className="join-choice" aria-keyshortcuts="C" disabled={dimensionalState !== DimensionalState.OnPlane} onClick={onTakeControl}>
              <CircleDot />
              <span>Control<small>Move them yourself on the plane.</small></span>
              <kbd>C</kbd>
            </button>
          </div>
          {dimensionalState === DimensionalState.OnPlane && !compactSelection && (
            <button className="join-choice create-choice" onClick={onOpenCreator}>
              <UserRoundPlus />
              <span>Create your citizen<small>Receive a home and occupation.</small></span>
            </button>
          )}
        </>
      )}

      {stage === "direct" && (
        <>
          {!compactSelection && (
            <div className="action-control-hint" aria-label="Direct control keys">
              <span><kbd>WASD</kbd>Move</span>
              <span><kbd>Shift</kbd>Faster</span>
            </div>
          )}
          <div className="direct-view-controls">
            <button className="button-secondary" onClick={() => onSetCamera(camera === "overhead" ? "chase" : "overhead")}>
              <Eye />{camera === "overhead" ? "Chase view" : "Overhead"}
            </button>
            <button className="button-secondary" onClick={() => onSetCamera(camera === "native" ? "chase" : "native")}>
              <ScanLine />{camera === "native" ? "Chase view" : "Native vision"}
            </button>
          </div>
          {blockedReason && (
            <button className="join-choice" onClick={onRecover}>
              <RotateCcw /><span>Return to safety<small>Move to the last clear place.</small></span>
            </button>
          )}
          {showDirectActions && (
            <div className="action-choice-grid action-primary-row">
              <button className="join-choice is-primary" aria-keyshortcuts="E" disabled={dimensionalState !== DimensionalState.OnPlane} onClick={onPickUp}>
                <Box /><span>Pick up<small>Lift this citizen above the plane.</small></span><kbd>E</kbd>
              </button>
              <button className="join-choice" aria-keyshortcuts="C" disabled={releasePending} onClick={() => onRelease()}>
                <CircleDot /><span>{releasePending ? "Stopping…" : "Stop control"}<small>Resume their routine.</small></span><kbd>C</kbd>
              </button>
            </div>
          )}
        </>
      )}

      {stage === "carry" && (
        <>
          <div className="action-step" aria-label="Current action stage">
            <span>✓</span><strong>Select</strong><i />
            <span>✓</span><strong>Pick up</strong><i />
            <span className="is-current">3</span><strong>{falling ? "Returning" : "Place"}</strong>
          </div>
          <p className={`carry-hint${falling ? " is-falling" : ""}`}>
            <strong>{falling ? `${resident.name} is falling.` : `${resident.name} is in hand.`}</strong>{" "}
            {falling ? "Height is closing until they meet the plane again." : "Move above Flatland, then place them with either option below."}
          </p>
          {!compactSelection && !falling && (
            <div className="action-control-hint" aria-label="Carrying controls">
              <span><kbd>WASD</kbd>Move</span>
              <span><kbd>Q / E</kbd>Height</span>
            </div>
          )}
          {showDropAction && !falling && (
            <button className="join-choice is-primary drop-choice" onClick={onDrop}>
              <Box /><span>Place here<small>Return them to the point directly below.</small></span><kbd>Space</kbd>
            </button>
          )}
          {!falling && (
            <button
              className={`join-choice precise-placement-choice ${tool === "reinsert" ? "is-selected" : ""}`}
              aria-pressed={tool === "reinsert"}
              aria-keyshortcuts={tool === "reinsert" ? "Escape" : undefined}
              onClick={onTogglePlacement}
            >
              <Map /><span>{tool === "reinsert" ? "Choose a green spot" : "Choose exact spot"}<small>{tool === "reinsert" ? "Use the map to place; Escape cancels." : "Select a different clear point on the map."}</small></span>
              {tool === "reinsert" && <kbd>Esc</kbd>}
            </button>
          )}
        </>
      )}
    </div>
  );
}
