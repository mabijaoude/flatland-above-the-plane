import { forwardRef } from "react";
import {
  BookOpenText,
  Compass,
  Eye,
  Frame,
  HelpCircle,
  History,
  Info,
  Map,
  Pause,
  Play,
  RotateCcw,
  Save,
  ScanLine
} from "lucide-react";
import type { CameraMode, ExperienceMode, QualityPreference } from "../types";

export const TOWN_MENU_SECTION_TITLES = [
  "Save & restore",
  "View & pace",
  "Explore",
  "Help & information"
] as const;

type TownMenuProps = {
  open: boolean;
  introActive: boolean;
  hasSidePanel: boolean;
  mode: ExperienceMode;
  projection: "perspective" | "orthographic";
  camera: CameraMode;
  controlled: boolean;
  carrying: boolean;
  nativeViewAvailable: boolean;
  paused: boolean;
  timeScale: number;
  quality: QualityPreference;
  savedAt?: string;
  saveDirty: boolean;
  onClose: () => void;
  onFrameTown: () => void;
  onToggleProjection: () => void;
  onSetCamera: (camera: CameraMode) => void;
  onTogglePaused: () => void;
  onSetTimeScale: (value: number) => void;
  onSetQuality: (quality: QualityPreference) => void;
  onOpenGazette: () => void;
  onReplayGuidedVisit: () => void;
  onSave: () => void;
  onRecall: () => void;
  onStartNewTown: () => void;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
};

function savedTimeLabel(savedAt: string | undefined) {
  if (!savedAt) return undefined;
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export const TownMenu = forwardRef<HTMLElement, TownMenuProps>(function TownMenu({
  open,
  introActive,
  hasSidePanel,
  mode,
  projection,
  camera,
  controlled,
  carrying,
  nativeViewAvailable,
  paused,
  timeScale,
  quality,
  savedAt,
  saveDirty,
  onClose,
  onFrameTown,
  onToggleProjection,
  onSetCamera,
  onTogglePaused,
  onSetTimeScale,
  onSetQuality,
  onOpenGazette,
  onReplayGuidedVisit,
  onSave,
  onRecall,
  onStartNewTown,
  onOpenHelp,
  onOpenAbout
}, ref) {
  const savedTime = savedTimeLabel(savedAt);
  const saveStatus = saveDirty
    ? "Unsaved changes"
    : savedAt
      ? savedTime ? `Saved ${savedTime}` : "Saved locally"
      : "Autosave ready";
  const actThenClose = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <footer
      ref={ref}
      id="town-controls"
      className={`world-controls ${open ? "is-open" : ""} ${introActive ? "is-intro" : ""} ${hasSidePanel ? "has-side-panel" : ""}`}
      aria-labelledby="town-menu-title"
      inert={introActive}
    >
      <div className="town-controls-heading">
        <div><p className="eyebrow">Town menu</p><h2 id="town-menu-title">Manage Flatland</h2></div>
      </div>

      <div className="town-menu-sections">
        <section className="town-menu-section town-menu-section--state" aria-labelledby="town-menu-state-title">
          <div className="town-menu-section-heading">
            <h3 id="town-menu-state-title">{TOWN_MENU_SECTION_TITLES[0]}</h3>
            <span className={`town-save-status ${saveDirty ? "is-dirty" : ""}`} role="status">{saveStatus}</span>
          </div>
          <div className="town-menu-action-grid town-menu-save-actions">
            <button type="button" className="town-menu-action is-primary" data-town-menu-autofocus onClick={actThenClose(onSave)}>
              <Save aria-hidden="true" />
              <span><strong>Save current town</strong><small>Keep this town in your browser</small></span>
            </button>
            <button type="button" className="town-menu-action" onClick={onRecall} disabled={!savedAt}>
              <History aria-hidden="true" />
              <span><strong>Restore saved town</strong><small>{savedAt ? "Return to the last save" : "No save available"}</small></span>
            </button>
          </div>
          <button type="button" className="town-menu-action town-menu-new-town is-danger" onClick={onStartNewTown}>
            <RotateCcw aria-hidden="true" />
            <span><strong>Start a new town</strong><small>Clear this browser's saved town</small></span>
          </button>
        </section>

        <section className="town-menu-section" aria-labelledby="town-menu-view-title">
          <div className="town-menu-section-heading">
            <h3 id="town-menu-view-title">{TOWN_MENU_SECTION_TITLES[1]}</h3>
          </div>
          <div className="town-menu-action-grid town-menu-view-actions">
            {mode === "explore" && (
              <button type="button" className="town-menu-action is-compact" onClick={actThenClose(onFrameTown)}>
                <Frame aria-hidden="true" /><span><strong>Frame town</strong><small>Overview</small></span>
              </button>
            )}
            {mode === "explore" && (
              <button type="button" className="town-menu-action is-compact" onClick={actThenClose(onToggleProjection)}>
                <Map aria-hidden="true" /><span><strong>{projection === "perspective" ? "Map view" : "Perspective"}</strong><small>{projection === "perspective" ? "Orthographic" : "Angled view"}</small></span>
              </button>
            )}
            {controlled && !carrying && (
              <button type="button" className="town-menu-action is-compact" onClick={actThenClose(() => onSetCamera(camera === "overhead" ? "chase" : "overhead"))}>
                <Eye aria-hidden="true" /><span><strong>{camera === "overhead" ? "Chase view" : "Overhead"}</strong><small>Citizen camera</small></span>
              </button>
            )}
            {nativeViewAvailable && !carrying && (
              <button type="button" className="town-menu-action is-compact" onClick={actThenClose(() => onSetCamera(camera === "native" ? (controlled ? "chase" : "follow") : "native"))}>
                <ScanLine aria-hidden="true" /><span><strong>{camera === "native" ? "Leave native" : "Native vision"}</strong><small>Flatlander's view</small></span>
              </button>
            )}
            <button type="button" className="town-menu-action is-compact" onClick={onTogglePaused}>
              {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              <span><strong>{paused ? "Resume town" : "Pause town"}</strong><small>{paused ? "Restart routines" : "Hold routines"}</small></span>
            </button>
          </div>
          <div className="town-menu-settings">
            <label><span>Town speed</span><select disabled={controlled} value={timeScale} onChange={(event) => onSetTimeScale(Number(event.target.value))}><option value={1}>{"1\u00d7"}</option><option value={4}>{"4\u00d7"}</option><option value={8}>{"8\u00d7"}</option><option value={16}>{"16\u00d7"}</option></select></label>
            <label><span>Visual detail</span><select value={quality} onChange={(event) => onSetQuality(event.target.value as QualityPreference)}><option value="auto">Auto</option><option value="cinematic">Cinematic</option><option value="balanced">Balanced</option><option value="lite">Lite</option></select></label>
          </div>
        </section>

        <section className="town-menu-section" aria-labelledby="town-menu-explore-title">
          <div className="town-menu-section-heading">
            <h3 id="town-menu-explore-title">{TOWN_MENU_SECTION_TITLES[2]}</h3>
          </div>
          <div className="town-menu-action-grid">
            <button type="button" className="town-menu-action is-compact" onClick={onOpenGazette}>
              <BookOpenText aria-hidden="true" /><span><strong>Town Gazette</strong><small>Recent events</small></span>
            </button>
            <button type="button" className="town-menu-action is-compact" onClick={onReplayGuidedVisit}>
              <Compass aria-hidden="true" /><span><strong>Guided visit</strong><small>Replay the tour</small></span>
            </button>
          </div>
        </section>

        <section className="town-menu-section town-menu-section--information" aria-labelledby="town-menu-information-title">
          <div className="town-menu-section-heading">
            <h3 id="town-menu-information-title">{TOWN_MENU_SECTION_TITLES[3]}</h3>
          </div>
          <div className="town-menu-information-actions">
            <button type="button" className="town-menu-information-action" onClick={onOpenHelp}><HelpCircle aria-hidden="true" /><span>Controls & shortcuts</span></button>
            <button type="button" className="town-menu-information-action" onClick={onOpenAbout}><Info aria-hidden="true" /><span>Source & context</span></button>
          </div>
        </section>
      </div>
    </footer>
  );
});
