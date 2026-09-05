import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpenText,
  Check,
  Clock3,
  Info,
  Maximize2,
  Menu,
  Minimize2,
  RefreshCcw,
  RotateCcw,
  Search,
  Scissors,
  X
} from "lucide-react";
import {
  DimensionalState,
  type CameraPoseSave,
  type ExperienceMode,
  type FlatworldSaveV3,
  type ResidentProfile,
  type ResidentStatic,
  type ResidentTelemetry,
  type SimEvent,
  type Vec2,
  type WorkerMessage,
  type WorldStatic
} from "./types";
import {
  cameraMode,
  controlledResidentId,
  experienceMode,
  experienceReducer,
  followedResidentId,
  initialExperienceState,
  interventionTool,
  joinPanel,
  primaryNavigationSection
} from "./experience";
import { SimulationClient, type SimulationLifecycle } from "./simulation/client";
import { clearSavedWorld, loadWorld, saveWorld, type LoadedWorld } from "./persistence";
import { chooseStartupDestination, WELCOME_STORAGE_KEY } from "./startup";
import { FlatworldScene, type CameraInput, type SceneExperience } from "./components/FlatworldScene";
import { NativeVision } from "./components/NativeVision";
import { CharacterCreator } from "./components/CharacterCreator";
import { TouchJoystick } from "./components/TouchJoystick";
import { ControlsDialog } from "./components/ControlsDialog";
import { CitizenActionPanel, citizenActionSheetSize, citizenActionStage, showCitizenActionDrawer } from "./components/CitizenActionPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { PeopleDirectory, type PeopleDirectoryResident } from "./components/PeopleDirectory";
import { GuidedVisit, type GuidedVisitAction } from "./components/GuidedVisit";
import { BookReader, type BookChapterId } from "./components/BookReader";
import { AdaptationContext } from "./components/AdaptationContext";
import { TownMenu } from "./components/TownMenu";
import { MobileFollowBar } from "./components/MobileFollowBar";
import type { BoundaryEditAction } from "./components/boundaryEditing";
import { DesktopCommandBar, type DesktopCommand } from "./components/DesktopCommandBar";
import { desktopCitizenInputMode } from "./components/controlNavigation";
import { WelcomeDialog } from "./components/WelcomeDialog";

function timeLabel(minutes: number) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = Math.floor(minutes % 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function shortcutBlockedTarget(target: EventTarget | null, code: string) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  if (element.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return true;
  return Boolean(element.closest("button") && ["Enter", "Space"].includes(code));
}

function useTouchFirstLayout() {
  const [touchFirst, setTouchFirst] = useState(() => window.matchMedia("(any-pointer: coarse) and (max-width: 900px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(any-pointer: coarse) and (max-width: 900px)");
    const update = () => setTouchFirst(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return touchFirst;
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reducedMotion;
}

function motionDescription(telemetry: ResidentTelemetry | undefined) {
  if (!telemetry) return "Waiting for the town to answer.";
  if (telemetry.blockedReason) return telemetry.blockedReason;
  if (telemetry.motionState === "waiting-capacity") return `Waiting for space at ${telemetry.destinationName}.`;
  if (telemetry.motionState === "waiting-portal") return `Yielding at an entrance on the way to ${telemetry.destinationName}.`;
  if (telemetry.motionState === "moving") return `Travelling to ${telemetry.destinationName}.`;
  if (telemetry.motionState === "controlled") return "Their routine is paused while you control them.";
  return telemetry.intent;
}

function midpointOf(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

export default function App() {
  const client = useMemo(() => new SimulationClient(), []);
  const [world, setWorld] = useState<WorldStatic>();
  const [residents, setResidents] = useState<ResidentStatic[]>([]);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [snapshot, setSnapshot] = useState<Extract<WorkerMessage, { type: "snapshot" }> & { data: Float32Array }>();
  const [experience, dispatch] = useReducer(experienceReducer, initialExperienceState);
  const [notice, setNotice] = useState("");
  const [guideMoment, setGuideMoment] = useState<"select" | null>(null);
  const [paused, setPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [frameSignal, setFrameSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [restorePoseSignal, setRestorePoseSignal] = useState(0);
  const [restorePose, setRestorePose] = useState<CameraPoseSave>();
  const [pendingWorldTarget, setPendingWorldTarget] = useState<Vec2>();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [mobileSheetSize, setMobileSheetSize] = useState<"collapsed" | "expanded">("expanded");
  const [creatorError, setCreatorError] = useState<string>();
  const [creatorPending, setCreatorPending] = useState(false);
  const [savedAt, setSavedAt] = useState<string>();
  const [saveDirty, setSaveDirty] = useState(false);
  const [bookStartChapter, setBookStartChapter] = useState<BookChapterId>();
  const [welcomeSeen, setWelcomeSeen] = useState(() => {
    try {
      return window.localStorage.getItem(WELCOME_STORAGE_KEY) === "seen"
        || window.localStorage.getItem("flatworld-guided-visit-v1") === "complete";
    } catch {
      return false;
    }
  });
  const [initialLoadedWorld, setInitialLoadedWorld] = useState<LoadedWorld | null>();
  const [startupReady, setStartupReady] = useState(false);
  const [cameraInput, setCameraInput] = useState<CameraInput>({ forward: 0, right: 0, altitude: 0, fast: false });
  const [simulationLifecycle, setSimulationLifecycle] = useState<SimulationLifecycle>(() => client.getLifecycle());
  const cameraPose = useRef<CameraPoseSave | undefined>(undefined);
  const pendingControl = useRef<{ requestId: number; residentId: number; returnTo: "survey" | "follow" } | undefined>(undefined);
  const pendingRelease = useRef<{ requestId: number; residentId: number; to?: "survey" | "follow" } | undefined>(undefined);
  const [releasePending, setReleasePending] = useState(false);
  const [dropPending, setDropPending] = useState(false);
  const [releaseAfterDrop, setReleaseAfterDrop] = useState<{ residentId: number; to: "survey" | "follow" }>();
  const timeScaleBeforeControl = useRef(1);
  const inputSequence = useRef(1);
  const snapshotRef = useRef<typeof snapshot>(undefined);
  const carriedPose = useRef<{ residentId: number; x: number; z: number; altitude: number } | undefined>(undefined);
  const carryOrigin = useRef<{ residentId: number; x: number; z: number } | undefined>(undefined);
  const wasCarrying = useRef(false);
  const carryExitTo = useRef<"survey" | "follow">("survey");
  const carryTouchInput = useRef({ x: 0, z: 0, altitude: 0, fast: false });
  const overflowButton = useRef<HTMLButtonElement>(null);
  const peopleButton = useRef<HTMLButtonElement>(null);
  const peopleWasOpen = useRef(false);
  const townControls = useRef<HTMLElement>(null);
  const tourMutationApplied = useRef(false);
  const tourStepRef = useRef(experience.tourStep);
  const tourDirtyBefore = useRef(false);
  const guidedUndoRestoreDirty = useRef<boolean | undefined>(undefined);
  const autoSaveInFlight = useRef(false);
  const startupApplied = useRef(false);
  const touchFirstLayout = useTouchFirstLayout();
  const reducedMotion = useReducedMotion();
  const forceTouchControls = useMemo(() => new URLSearchParams(window.location.search).has("touch"), []);
  const touchControlsEnabled = touchFirstLayout || forceTouchControls;
  snapshotRef.current = snapshot;

  useEffect(() => {
    tourStepRef.current = experience.tourStep;
  }, [experience.tourStep]);

  const mode = experienceMode(experience);
  const actionSection = mode === "intervene" ? "plane" : "citizen";
  const navigationSection = primaryNavigationSection(experience);
  const camera = cameraMode(experience);
  const controlledId = controlledResidentId(experience);
  const followedId = followedResidentId(experience);
  const panel = joinPanel(experience);
  const tool = interventionTool(experience);
  const overlay = experience.overlay;
  const gazetteOpen = overlay === "gazette";
  const overflowOpen = overlay === "town";
  const peopleOpen = overlay === "people";
  const helpOpen = overlay === "help";
  const bookOpen = overlay === "book";
  const aboutOpen = overlay === "about";
  const setOverflowOpen = useCallback((next: boolean | ((open: boolean) => boolean)) => {
    const open = typeof next === "function" ? next(overflowOpen) : next;
    dispatch({ type: "set-overlay", overlay: open ? "town" : "none" });
  }, [overflowOpen]);
  const setGazetteOpen = useCallback((next: boolean | ((open: boolean) => boolean)) => {
    const open = typeof next === "function" ? next(gazetteOpen) : next;
    dispatch({ type: "set-overlay", overlay: open ? "gazette" : "none" });
  }, [gazetteOpen]);
  const setHelpOpen = useCallback((next: boolean | ((open: boolean) => boolean)) => {
    const open = typeof next === "function" ? next(helpOpen) : next;
    dispatch({ type: "set-overlay", overlay: open ? "help" : "none" });
  }, [helpOpen]);
  const openBook = useCallback((chapter?: BookChapterId) => {
    setBookStartChapter(chapter);
    dispatch({ type: "set-overlay", overlay: "book" });
  }, []);
  useEffect(() => {
    if (peopleOpen) {
      peopleWasOpen.current = true;
      return;
    }
    if (!peopleWasOpen.current) return;
    peopleWasOpen.current = false;
    if (experience.tourStep !== "idle") return;
    const frame = requestAnimationFrame(() => peopleButton.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [experience.tourStep, peopleOpen]);
  const selectedSnapshotOffset = experience.selectedResidentId === null ? -1 : experience.selectedResidentId * (snapshot?.stride ?? 0);
  const selectedDimensionalState = snapshot && experience.selectedResidentId !== null
    ? snapshot.data[selectedSnapshotOffset + 4]
    : undefined;
  const liftedSelectedId = experience.selectedResidentId !== null && (selectedDimensionalState === DimensionalState.OffPlane || selectedDimensionalState === DimensionalState.BeingReinserted)
    ? experience.selectedResidentId
    : null;
  const controlledSnapshotOffset = controlledId === null ? -1 : controlledId * (snapshot?.stride ?? 0);
  const controlledDimensionalState = snapshot && controlledId !== null
    ? snapshot.data[controlledSnapshotOffset + 4]
    : undefined;
  const liftedControlledId = controlledId !== null && (controlledDimensionalState === DimensionalState.OffPlane || controlledDimensionalState === DimensionalState.BeingReinserted)
    ? controlledId
    : null;
  const carriedId = liftedControlledId ?? liftedSelectedId;
  const fallingId = controlledDimensionalState === DimensionalState.BeingReinserted
    ? controlledId
    : selectedDimensionalState === DimensionalState.BeingReinserted
      ? experience.selectedResidentId
      : null;
  const fallInProgress = dropPending || fallingId !== null;
  const fallingAltitude = fallingId !== null && snapshot
    ? Math.max(0, snapshot.data[fallingId * snapshot.stride + 3])
    : carriedId !== null && snapshot
      ? Math.max(0, snapshot.data[carriedId * snapshot.stride + 3])
      : 0;
  const activeResidentId = carriedId ?? controlledId ?? followedId;
  useEffect(() => {
    const justFinishedCarrying = carriedId === null && wasCarrying.current;
    setMobileSheetSize(citizenActionSheetSize(
      carriedId !== null,
      justFinishedCarrying,
      controlledId !== null,
      followedId !== null
    ));
    if (carriedId !== null) {
      wasCarrying.current = true;
      return;
    }
    if (justFinishedCarrying) {
      wasCarrying.current = false;
    }
  }, [carriedId, controlledId, followedId]);
  const sceneExperience = useMemo<SceneExperience>(() => ({
    mode,
    cameraMode: camera,
    projection: experience.projection,
    selectedResidentId: activeResidentId ?? experience.selectedResidentId,
    followedResidentId: followedId,
    controlledResidentId: controlledId,
    carriedResidentId: carriedId,
    fallingResidentId: fallingId,
    introActive: experience.introActive,
    interventionTool: tool
  }), [activeResidentId, camera, carriedId, controlledId, experience.introActive, experience.projection, experience.selectedResidentId, fallingId, followedId, mode, tool]);

  useEffect(() => {
    if (carriedId === null || !snapshot) {
      carriedPose.current = undefined;
      carryTouchInput.current = { x: 0, z: 0, altitude: 0, fast: false };
      return;
    }
    if (carriedPose.current?.residentId === carriedId) return;
    const offset = carriedId * snapshot.stride;
    carriedPose.current = {
      residentId: carriedId,
      x: snapshot.data[offset],
      z: snapshot.data[offset + 1],
      altitude: snapshot.data[offset + 3] || 5
    };
  }, [carriedId, snapshot]);

  useEffect(() => {
    const unsubscribe = client.subscribeLifecycle(setSimulationLifecycle);
    return () => { unsubscribe(); };
  }, [client]);

  useEffect(() => {
    const unsubscribe = client.subscribe((message: WorkerMessage) => {
      if (message.type === "ready") {
        setWorld(message.world);
        setResidents(message.residents);
        setEvents(message.events);
      } else if (message.type === "snapshot") {
        setSnapshot({ ...message, data: new Float32Array(message.buffer) });
      } else if (message.type === "world-changed") setWorld(message.world);
      else if (message.type === "residents-changed") setResidents(message.residents);
      else if (message.type === "events") setEvents(message.events);
      else if (message.type === "command-result") {
        setNotice(message.message);
        if (message.ok && ["create-resident", "lift", "drop", "reinsert", "cut-at", "seal-at", "reset-plane", "undo-intervention"].includes(message.command)) {
          setSaveDirty(true);
        }
        if (message.command === "begin-resident-control") {
          if (!pendingControl.current || pendingControl.current.requestId !== message.requestId) return;
          const requested = pendingControl.current;
          pendingControl.current = undefined;
          if (message.ok) {
            dispatch({ type: "begin-control", residentId: requested.residentId, returnTo: requested.returnTo });
            setTimeScale(1);
            requestAnimationFrame(() => document.getElementById("flatworld-canvas")?.focus());
          }
        }
        if (message.command === "end-resident-control" && pendingRelease.current?.requestId === message.requestId) {
          const requested = pendingRelease.current;
          if (!requested) return;
          pendingRelease.current = undefined;
          setReleasePending(false);
          if (message.ok) {
            dispatch({ type: "end-control", to: requested.to });
            setTimeScale(timeScaleBeforeControl.current);
          }
        }
        if (message.command === "create-resident") {
          setCreatorPending(false);
          if (!message.ok) setCreatorError(message.message);
          else if (message.residentId !== undefined) {
            setCreatorError(undefined);
            dispatch({ type: "created", residentId: message.residentId });
            const requestId = client.nextRequestId();
            pendingControl.current = { requestId, residentId: message.residentId, returnTo: "survey" };
            client.send({ type: "begin-resident-control", residentId: message.residentId, requestId });
          }
        }
        if (message.command === "lift" && message.ok && message.residentId !== undefined) {
          dispatch({ type: "set-tool", tool: "carry" });
          requestAnimationFrame(() => document.getElementById("flatworld-canvas")?.focus());
        }
        if (message.command === "drop") {
          setDropPending(false);
          if (message.ok) carryOrigin.current = undefined;
          else setReleaseAfterDrop(undefined);
        }
        if (message.command === "reinsert") {
          if (message.ok) carryOrigin.current = undefined;
          else setReleaseAfterDrop(undefined);
        }
        if (message.ok && ["cut-at", "seal-at"].includes(message.command)) {
          setUndoAvailable(true);
          if (tourStepRef.current === "plane-preview") {
            tourMutationApplied.current = true;
            dispatch({ type: "set-tour-step", step: "undo" });
          }
        }
        if (message.ok && ["undo-intervention", "reset-plane"].includes(message.command)) {
          setUndoAvailable(message.command === "reset-plane");
          if (message.command === "undo-intervention" && guidedUndoRestoreDirty.current !== undefined) {
            setSaveDirty(guidedUndoRestoreDirty.current);
            guidedUndoRestoreDirty.current = undefined;
          }
          if (message.command === "undo-intervention" && tourStepRef.current === "undo") {
            tourMutationApplied.current = false;
            dispatch({ type: "set-tour-step", step: "complete" });
          }
        }
        if (message.ok && ["drop", "reinsert"].includes(message.command)) dispatch({ type: "set-tool", tool: "none" });
        if (message.ok && (message.command === "reset-plane" || message.command === "undo-intervention" && tourStepRef.current === "undo")) {
          dispatch({ type: "set-tool", tool: "none" });
        }
      }
    });
    return () => {
      unsubscribe();
      client.dispose();
    };
  }, [client]);

  useEffect(() => {
    if (!notice || /could not|cannot|no remembered|not available|failed|blocked/i.test(notice)) return;
    const timeout = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!overflowOpen) return;
    const frame = requestAnimationFrame(() => {
      const preferredTarget = townControls.current?.querySelector<HTMLElement>("[data-town-menu-autofocus]");
      const fallbackTarget = townControls.current?.querySelector<HTMLElement>("button:not(:disabled), select:not(:disabled)");
      (preferredTarget ?? fallbackTarget)?.focus();
    });
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (townControls.current?.contains(target) || overflowButton.current?.contains(target)) return;
      setOverflowOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOutside);
      if (townControls.current?.contains(document.activeElement)) {
        requestAnimationFrame(() => overflowButton.current?.focus());
      }
    };
  }, [overflowOpen]);

  const screenToWorld = useCallback((moveX: number, moveZ: number): Vec2 => {
    const pose = cameraPose.current;
    let forward = pose
      ? { x: pose.target[0] - pose.position[0], z: pose.target[2] - pose.position[2] }
      : { x: 0, z: -1 };
    const length = Math.hypot(forward.x, forward.z);
    forward = length > 0.001 ? { x: forward.x / length, z: forward.z / length } : { x: 0, z: -1 };
    const right = { x: -forward.z, z: forward.x };
    const worldVector = { x: right.x * moveX + forward.x * moveZ, z: right.z * moveX + forward.z * moveZ };
    const magnitude = Math.hypot(worldVector.x, worldVector.z);
    return magnitude > 1 ? { x: worldVector.x / magnitude, z: worldVector.z / magnitude } : worldVector;
  }, []);

  const sendControlInput = useCallback((moveX: number, moveZ: number, sprint: boolean) => {
    if (controlledId === null) return;
    client.send({
      type: "set-resident-input",
      residentId: controlledId,
      move: screenToWorld(moveX, moveZ),
      sprint,
      sequence: inputSequence.current++,
      sentAt: performance.now()
    });
  }, [client, controlledId, screenToWorld]);

  const sendSteeringControlInput = useCallback((turn: number, forward: number, sprint: boolean) => {
    if (controlledId === null) return;
    client.send({
      type: "set-resident-steering",
      residentId: controlledId,
      forward,
      turn,
      sprint,
      sequence: inputSequence.current++,
      sentAt: performance.now()
    });
  }, [client, controlledId]);

  const sendActiveControlInput = camera === "native" ? sendSteeringControlInput : sendControlInput;
  const sendDesktopControlInput = desktopCitizenInputMode(camera) === "directional"
    ? sendControlInput
    : sendSteeringControlInput;

  const releaseWorkerControl = useCallback((residentId: number) => {
    client.send({
      type: "set-resident-input",
      residentId,
      move: { x: 0, z: 0 },
      sprint: false,
      sequence: inputSequence.current++,
      sentAt: performance.now()
    });
    const requestId = client.nextRequestId();
    client.send({ type: "end-resident-control", residentId, resumeRoutine: true, requestId });
    return requestId;
  }, [client]);

  useEffect(() => {
    if (!releaseAfterDrop || dropPending || carriedId !== null) return;
    if (controlledId !== releaseAfterDrop.residentId) {
      setReleaseAfterDrop(undefined);
      return;
    }
    const requestId = releaseWorkerControl(releaseAfterDrop.residentId);
    pendingRelease.current = { requestId, residentId: releaseAfterDrop.residentId, to: releaseAfterDrop.to };
    setReleasePending(true);
    setReleaseAfterDrop(undefined);
  }, [carriedId, controlledId, dropPending, releaseAfterDrop, releaseWorkerControl]);

  const releaseControl = useCallback((to?: "survey" | "follow") => {
    if (controlledId === null || releasePending) return;
    const requestId = releaseWorkerControl(controlledId);
    pendingRelease.current = { requestId, residentId: controlledId, to };
    setReleasePending(true);
  }, [controlledId, releasePending, releaseWorkerControl]);

  const takeControl = useCallback((residentId: number) => {
    if (controlledId !== null && controlledId !== residentId) releaseWorkerControl(controlledId);
    timeScaleBeforeControl.current = timeScale;
    const requestId = client.nextRequestId();
    pendingControl.current = { requestId, residentId, returnTo: followedId === residentId ? "follow" : "survey" };
    client.send({ type: "begin-resident-control", residentId, requestId });
  }, [client, controlledId, followedId, releaseWorkerControl, timeScale]);

  const followResident = useCallback((residentId: number) => {
    if (controlledId !== null) releaseWorkerControl(controlledId);
    dispatch({ type: "follow", residentId });
    if (touchControlsEnabled) dispatch({ type: "select", residentId: null });
    const resident = residents[residentId];
    if (resident && !touchControlsEnabled) setNotice(`${resident.name} remains autonomous while the camera follows their routine.`);
  }, [controlledId, releaseWorkerControl, residents, touchControlsEnabled]);

  const stopFollowing = useCallback(() => {
    dispatch({ type: "stop-follow" });
    if (touchControlsEnabled) dispatch({ type: "select", residentId: null });
  }, [touchControlsEnabled]);

  const switchMode = useCallback((nextMode: ExperienceMode) => {
    if (carriedId !== null && nextMode !== "intervene") {
      setNotice("Drop or place the citizen before leaving the plane tools.");
      return;
    }
    setOverflowOpen(false);
    if (controlledId !== null && nextMode !== "join") {
      releaseControl("survey");
      return;
    }
    setGuideMoment(null);
    dispatch({ type: "set-mode", mode: nextMode });
  }, [carriedId, controlledId, releaseControl, setOverflowOpen]);

  const planeToolsOpen = navigationSection === "plane";
  useEffect(() => {
    if (touchControlsEnabled && planeToolsOpen) setMobileSheetSize("collapsed");
  }, [planeToolsOpen, touchControlsEnabled]);
  const openPlaneTools = useCallback(() => {
    setOverflowOpen(false);
    if (controlledId !== null || carriedId !== null) {
      setNotice("Release or place the controlled citizen before changing the plane.");
      return;
    }
    if (planeToolsOpen) {
      dispatch({ type: "set-mode", mode: "explore" });
      return;
    }
    switchMode("intervene");
  }, [carriedId, controlledId, planeToolsOpen, switchMode]);

  const openPeopleDirectory = useCallback(() => {
    setPendingWorldTarget(undefined);
    setGuideMoment(null);
    if (mode === "intervene") dispatch({ type: "set-mode", mode: "explore" });
    dispatch({ type: "set-overlay", overlay: "people" });
  }, [mode]);

  const liftResident = useCallback((residentId: number) => {
    const currentSnapshot = snapshotRef.current;
    if (currentSnapshot && residentId < currentSnapshot.residentCount) {
      const offset = residentId * currentSnapshot.stride;
      carryOrigin.current = { residentId, x: currentSnapshot.data[offset], z: currentSnapshot.data[offset + 1] };
    }
    dispatch({ type: "select", residentId });
    client.send({ type: "lift", residentId });
  }, [client]);

  const quickPickUpResident = useCallback((residentId: number) => {
    if (carriedId !== null) {
      setNotice("Place the citizen already in hand before picking up another.");
      return;
    }
    dispatch({ type: "set-overlay", overlay: "none" });
    dispatch({ type: "select", residentId });
    liftResident(residentId);
  }, [carriedId, liftResident]);

  const frameTown = useCallback(() => {
    if (mode !== "explore") return;
    if (experience.introActive) setGuideMoment("select");
    dispatch({ type: "frame-town" });
    setFrameSignal((signal) => signal + 1);
    setNotice("The complete town resolves into an engraved survey plate.");
  }, [experience.introActive, mode]);

  const toggleProjection = useCallback(() => {
    if (mode !== "explore") return;
    if (experience.introActive) setGuideMoment("select");
    dispatch({ type: "set-projection", projection: experience.projection === "perspective" ? "orthographic" : "perspective" });
    if (camera === "framed") dispatch({ type: "set-camera", cameraMode: "survey" });
  }, [camera, experience.introActive, experience.projection, mode]);

  const closeNative = useCallback(() => {
    if (controlledId !== null) dispatch({ type: "set-camera", cameraMode: "chase" });
    else if (followedId !== null) dispatch({ type: "set-camera", cameraMode: "follow" });
  }, [controlledId, followedId]);

  const recenterCamera = useCallback(() => {
    if (camera === "framed") {
      dispatch({ type: "set-camera", cameraMode: "survey" });
      dispatch({ type: "set-projection", projection: "perspective" });
    }
    setResetSignal((signal) => signal + 1);
  }, [camera]);

  const beginDrop = useCallback((target?: Vec2, releaseTo?: "survey" | "follow") => {
    const pose = carriedPose.current;
    if (fallInProgress) return;
    if (carriedId === null || !pose || pose.residentId !== carriedId) {
      setNotice("Lift a citizen before choosing where to drop them.");
      return;
    }
    carryTouchInput.current = { x: 0, z: 0, altitude: 0, fast: false };
    setDropPending(true);
    if (releaseTo) setReleaseAfterDrop({ residentId: carriedId, to: releaseTo });
    client.send({ type: "drop", residentId: carriedId, target, reducedMotion });
    dispatch({ type: "set-tool", tool: "none" });
  }, [carriedId, client, fallInProgress, reducedMotion]);

  const dropLiftedCitizen = useCallback(() => {
    beginDrop(undefined, controlledId === carriedId ? "survey" : undefined);
  }, [beginDrop, carriedId, controlledId]);

  const setCarryTouch = useCallback((x: number, z: number, fast: boolean) => {
    carryTouchInput.current = { ...carryTouchInput.current, x, z, fast };
  }, []);

  const setCarryAltitude = useCallback((altitude: number) => {
    carryTouchInput.current = { ...carryTouchInput.current, altitude };
  }, []);

  const rememberWelcomeSeen = useCallback(() => {
    setWelcomeSeen(true);
    try {
      window.localStorage.setItem(WELCOME_STORAGE_KEY, "seen");
    } catch {
      // A private or restricted browser may reject local preferences.
    }
  }, []);

  const rememberTourCompletion = useCallback(() => {
    rememberWelcomeSeen();
    try {
      window.localStorage.setItem("flatworld-guided-visit-v1", "complete");
    } catch {
      // A private or restricted browser may reject local preferences.
    }
  }, [rememberWelcomeSeen]);

  const cancelGuidedVisit = useCallback(() => {
    tourStepRef.current = "idle";
    if (tourMutationApplied.current) {
      guidedUndoRestoreDirty.current = tourDirtyBefore.current;
      client.send({ type: "undo-intervention" });
      tourMutationApplied.current = false;
    }
    closeNative();
    dispatch({ type: "cancel-tour" });
    setGuideMoment(null);
    rememberTourCompletion();
  }, [client, closeNative, rememberTourCompletion]);

  const navigateBack = useCallback(() => {
    if (panel === "create" && !creatorPending) {
      dispatch({ type: "set-mode", mode: "join" });
      return;
    }
    if (overlay !== "none") {
      dispatch({ type: "back" });
      return;
    }
    if (camera === "native") {
      closeNative();
      return;
    }
    if (carriedId !== null && tool === "reinsert") {
      setPendingWorldTarget(undefined);
      dispatch({ type: "set-tool", tool: "carry" });
      if (!touchControlsEnabled) {
        setMobileSheetSize("expanded");
        setNotice("Precise placement cancelled. The citizen remains in hand.");
      } else setNotice("");
      return;
    }
    if (carriedId !== null) {
      carryExitTo.current = experience.activity.kind === "embodied" ? experience.activity.returnTo : "survey";
      dispatch({ type: "set-overlay", overlay: "confirm-carry-exit" });
      return;
    }
    if (controlledId !== null) {
      releaseControl();
      return;
    }
    if (touchControlsEnabled && followedId !== null) {
      if (experience.selectedResidentId !== null) dispatch({ type: "select", residentId: null });
      else stopFollowing();
      return;
    }
    if (experience.tourStep !== "idle" && experience.tourStep !== "complete") {
      cancelGuidedVisit();
      return;
    }
    if (guideMoment !== null) {
      setGuideMoment(null);
      return;
    }
    dispatch({ type: "back" });
  }, [camera, cancelGuidedVisit, carriedId, closeNative, controlledId, creatorPending, experience.activity, experience.selectedResidentId, experience.tourStep, followedId, guideMoment, overlay, panel, releaseControl, stopFollowing, tool, touchControlsEnabled]);

  const isNavigationRoot = experience.introActive
    || (mode === "explore"
      && camera === "survey"
      && experience.selectedResidentId === null
      && overlay === "none"
      && experience.tourStep === "idle");
  const historyArmed = useRef(false);
  useEffect(() => {
    if (!isNavigationRoot && !historyArmed.current) {
      window.history.pushState({ ...(window.history.state ?? {}), flatworldNavigation: true }, "");
      historyArmed.current = true;
    }
    if (isNavigationRoot) historyArmed.current = false;
  }, [isNavigationRoot]);
  useEffect(() => {
    const pop = () => {
      if (isNavigationRoot) return;
      historyArmed.current = false;
      navigateBack();
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [isNavigationRoot, navigateBack]);

  useEffect(() => {
    const pressed = new Set<string>();
    let lastSent = "";
    let lastSentAt = 0;
    let lastCarryAt = performance.now();
    const updateCamera = () => setCameraInput(carriedId === null ? {
      forward: (pressed.has("KeyW") || pressed.has("ArrowUp") ? 1 : 0) - (pressed.has("KeyS") || pressed.has("ArrowDown") ? 1 : 0),
      right: (pressed.has("KeyD") || pressed.has("ArrowRight") ? 1 : 0) - (pressed.has("KeyA") || pressed.has("ArrowLeft") ? 1 : 0),
      altitude: (pressed.has("KeyE") ? 1 : 0) - (pressed.has("KeyQ") ? 1 : 0),
      fast: pressed.has("ShiftLeft") || pressed.has("ShiftRight")
    } : { forward: 0, right: 0, altitude: 0, fast: false });
    const clear = () => {
      pressed.clear();
      carryTouchInput.current = { x: 0, z: 0, altitude: 0, fast: false };
      updateCamera();
      if (controlledId !== null) sendDesktopControlInput(0, 0, false);
    };
    const down = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        navigateBack();
        return;
      }
      if (shortcutBlockedTarget(event.target, event.code)) return;
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyK") {
        event.preventDefault();
        openPeopleDirectory();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyZ" && planeToolsOpen && undoAvailable) {
        event.preventDefault();
        client.send({ type: "undo-intervention" });
        return;
      }
      const movementCodes = [
        "KeyW", "KeyA", "KeyS", "KeyD",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
        "ShiftLeft", "ShiftRight",
        ...(carriedId !== null ? ["KeyQ", "KeyE"] : [])
      ];
      if (movementCodes.includes(event.code)) {
        event.preventDefault();
        pressed.add(event.code);
        updateCamera();
        if (experience.introActive) {
          dispatch({ type: "cancel-intro" });
          setGuideMoment("select");
        } else if (camera === "framed") dispatch({ type: "set-camera", cameraMode: "survey" });
        return;
      }
      if (event.repeat) return;
      if (event.code === "Space" && carriedId !== null) {
        event.preventDefault();
        dropLiftedCitizen();
      } else if (event.code === "KeyE" && carriedId === null && experience.selectedResidentId !== null) {
        event.preventDefault();
        quickPickUpResident(experience.selectedResidentId);
      } else if (event.code === "KeyT") {
        event.preventDefault();
        openPlaneTools();
      } else if (event.code === "Enter" && pendingWorldTarget && tool === "reinsert" && carriedId !== null) {
        event.preventDefault();
        if (controlledId === carriedId) setReleaseAfterDrop({ residentId: carriedId, to: "survey" });
        client.send({ type: "reinsert", residentId: carriedId, target: pendingWorldTarget });
        setPendingWorldTarget(undefined);
      } else if (event.code === "KeyF") {
        event.preventDefault();
        if (controlledId !== null && carriedId === null) dispatch({ type: "set-camera", cameraMode: camera === "overhead" ? "chase" : "overhead" });
        else if (experience.selectedResidentId !== null) {
          if (followedId === experience.selectedResidentId) stopFollowing();
          else followResident(experience.selectedResidentId);
        } else frameTown();
      } else if (event.code === "KeyR") {
        event.preventDefault();
        recenterCamera();
      } else if (event.code === "KeyO") {
        event.preventDefault();
        toggleProjection();
      } else if (event.code === "KeyC" && carriedId === null) {
        const targetResidentId = experience.selectedResidentId ?? followedId;
        if (controlledId !== null) {
          event.preventDefault();
          releaseControl();
        } else if (targetResidentId !== null) {
          event.preventDefault();
          takeControl(targetResidentId);
        }
      } else if (event.code === "KeyV" && (controlledId !== null || followedId !== null) && carriedId === null) {
        event.preventDefault();
        dispatch({
          type: "set-camera",
          cameraMode: camera === "native" ? (controlledId !== null ? "chase" : "follow") : "native"
        });
      } else if (event.code === "KeyH" || event.code === "Slash") {
        event.preventDefault();
        setHelpOpen((open) => !open);
      }
    };
    const up = (event: KeyboardEvent) => {
      pressed.delete(event.code);
      updateCamera();
    };
    const interval = window.setInterval(() => {
      const keyX = (pressed.has("KeyD") || pressed.has("ArrowRight") ? 1 : 0) - (pressed.has("KeyA") || pressed.has("ArrowLeft") ? 1 : 0);
      const keyZ = (pressed.has("KeyW") || pressed.has("ArrowUp") ? 1 : 0) - (pressed.has("KeyS") || pressed.has("ArrowDown") ? 1 : 0);
      const sprint = pressed.has("ShiftLeft") || pressed.has("ShiftRight");
      const now = performance.now();
      if (carriedId !== null) {
        if (fallInProgress) {
          lastCarryAt = now;
          return;
        }
        const pose = carriedPose.current;
        const touch = carryTouchInput.current;
        const x = Math.max(-1, Math.min(1, keyX + touch.x));
        const z = Math.max(-1, Math.min(1, keyZ + touch.z));
        const altitudeInput = (pressed.has("KeyE") ? 1 : 0) - (pressed.has("KeyQ") ? 1 : 0) + touch.altitude;
        const dt = Math.min(0.08, Math.max(0, (now - lastCarryAt) / 1000));
        if (pose?.residentId === carriedId && (x || z || altitudeInput)) {
          const direction = screenToWorld(x, z);
          const speed = sprint || touch.fast ? 20 : 11;
          pose.x = Math.max(world?.bounds.minX ?? -70, Math.min(world?.bounds.maxX ?? 70, pose.x + direction.x * speed * dt));
          pose.z = Math.max(world?.bounds.minZ ?? -52, Math.min(world?.bounds.maxZ ?? 52, pose.z + direction.z * speed * dt));
          pose.altitude = Math.max(1.5, Math.min(14, pose.altitude + altitudeInput * 7 * dt));
          client.send({ type: "move-lifted", residentId: carriedId, target: { x: pose.x, z: pose.z }, altitude: pose.altitude });
        }
        lastCarryAt = now;
        return;
      }
      lastCarryAt = now;
      if (controlledId === null) return;
      const x = keyX;
      const z = keyZ;
      const signature = `${x},${z},${sprint}`;
      if (signature !== lastSent || ((x || z) && now - lastSentAt > 250)) {
        sendDesktopControlInput(x, z, sprint);
        lastSent = signature;
        lastSentAt = now;
      }
    }, 45);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      clear();
    };
  }, [camera, carriedId, client, controlledId, dropLiftedCitizen, experience.introActive, experience.selectedResidentId, fallInProgress, followedId, followResident, frameTown, navigateBack, openPeopleDirectory, openPlaneTools, pendingWorldTarget, planeToolsOpen, quickPickUpResident, recenterCamera, releaseControl, screenToWorld, sendDesktopControlInput, setHelpOpen, stopFollowing, takeControl, toggleProjection, tool, undoAvailable, world]);

  const storeSave = useCallback(async (silent = false) => {
    if (!world || autoSaveInFlight.current) return;
    autoSaveInFlight.current = true;
    try {
      const simulation = await client.requestSave();
      const rememberedFollow = controlledId ?? followedId;
      const savedAtIso = new Date().toISOString();
      const save: FlatworldSaveV3 = {
        version: 3,
        savedAt: savedAtIso,
        simulation,
        session: {
          mode: controlledId === null ? mode : "explore",
          cameraMode: rememberedFollow !== null ? "follow" : camera === "framed" ? "framed" : "survey",
          selectedResidentId: experience.selectedResidentId,
          followedResidentId: rememberedFollow,
          lastControlledResidentId: experience.lastControlledResidentId,
          playerResidentIds: experience.playerResidentIds,
          cameraPose: cameraPose.current,
          quality: experience.quality
        }
      };
      await saveWorld(save);
      setSavedAt(savedAtIso);
      setSaveDirty(false);
      if (!silent) setNotice("Saved in this browser.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The browser could not save this town.");
    } finally {
      autoSaveInFlight.current = false;
    }
  }, [camera, client, controlledId, experience.lastControlledResidentId, experience.playerResidentIds, experience.quality, experience.selectedResidentId, followedId, mode, world]);

  useEffect(() => {
    let active = true;
    void loadWorld().then((loaded) => {
      if (!active) return;
      if (loaded && loaded.kind !== "legacy") setSavedAt(loaded.save.savedAt);
      setInitialLoadedWorld(loaded ?? null);
    }).catch(() => {
      if (active) setInitialLoadedWorld(null);
      // The explicit save action will surface storage failures.
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (startupApplied.current || !world || !snapshot || initialLoadedWorld === undefined) return;
    startupApplied.current = true;
    const destination = chooseStartupDestination(welcomeSeen, initialLoadedWorld ?? undefined);

    if (destination === "resume" && initialLoadedWorld && initialLoadedWorld.kind !== "legacy") {
      const loaded = initialLoadedWorld;
      client.send({ type: "load-save", save: loaded.save.simulation });
      const session = loaded.save.session;
      const rememberedFollow = session.followedResidentId ?? session.lastControlledResidentId;
      dispatch({
        type: "restore-session",
        state: {
          mode: session.mode,
          cameraMode: rememberedFollow !== null ? "follow" : session.cameraMode === "framed" ? "framed" : "survey",
          selectedResidentId: touchControlsEnabled && rememberedFollow !== null ? null : session.selectedResidentId,
          followedResidentId: rememberedFollow,
          lastControlledResidentId: session.lastControlledResidentId,
          playerResidentIds: session.playerResidentIds,
          projection: session.cameraPose?.projection ?? "perspective",
          quality: session.quality
        }
      });
      if (session.cameraPose) {
        cameraPose.current = session.cameraPose;
        setRestorePose(session.cameraPose);
        setRestorePoseSignal((signal) => signal + 1);
      }
      setSavedAt(loaded.save.savedAt);
      setSaveDirty(false);
    } else if (destination === "fresh") {
      dispatch({ type: "cancel-intro" });
    }

    setStartupReady(true);
  }, [client, initialLoadedWorld, snapshot, touchControlsEnabled, welcomeSeen, world]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (tourStepRef.current === "idle" && guidedUndoRestoreDirty.current === undefined) void storeSave(true);
    }, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && tourStepRef.current === "idle" && guidedUndoRestoreDirty.current === undefined) void storeSave(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [storeSave]);

  if (!world || !snapshot || !startupReady) {
    if (simulationLifecycle.status === "error") {
      return (
        <main className="boot-shell is-error">
          <AlertTriangle aria-hidden="true" />
          <span>Flatland could not open</span>
          <p>{simulationLifecycle.message}</p>
          <button type="button" onClick={() => client.restart()}>Try again</button>
        </main>
      );
    }
    return (
      <main className="boot-shell" aria-live="polite">
        <span>Flatland</span>
        <p>Opening the morning streets…</p>
      </main>
    );
  }

  const selected = experience.selectedResidentId === null ? undefined : residents[experience.selectedResidentId];
  const followedResident = followedId === null ? undefined : residents[followedId];
  const activeResident = activeResidentId === null ? undefined : residents[activeResidentId];
  const joinResident = activeResident ?? selected ?? residents[0];
  const actionStage = joinResident ? citizenActionStage(joinResident.id, controlledId, carriedId) : "choose";
  const selectedOffset = joinResident ? joinResident.id * snapshot.stride : 0;
  const selectedState = joinResident ? snapshot.data[selectedOffset + 4] ?? DimensionalState.OnPlane : DimensionalState.OnPlane;
  const selectedTelemetry = joinResident ? snapshot.telemetry[joinResident.id] : undefined;
  const latestEvent = events.at(-1);
  const placementTargets = tool === "reinsert"
    ? [
      ...world.buildings.map((building) => ({
        id: `venue-${building.id}`,
        point: { ...building.entrance.insideStage },
        label: `${building.shortName} entrance`
      })),
      ...world.publicPlaces.map((place) => ({
        id: `place-${place.id}`,
        point: { ...place.center },
        label: place.name
      }))
    ]
    : [];
  const nativeResidentId = controlledId ?? followedId;
  const directoryResidents: PeopleDirectoryResident[] = residents.map((resident) => {
    const telemetry = snapshot.telemetry[resident.id];
    const offset = resident.id * snapshot.stride;
    const dimensionalState = snapshot.data[offset + 4] ?? DimensionalState.OnPlane;
    const unavailableWhileCarrying = carriedId !== null && carriedId !== resident.id
      ? "Place the carried citizen first."
      : undefined;
    const unavailableWhileDirecting = controlledId !== null && controlledId !== resident.id
      ? `Release ${residents[controlledId]?.name ?? "the current citizen"} first.`
      : undefined;
    const unavailableOffPlane = dimensionalState !== DimensionalState.OnPlane
      ? dimensionalState === DimensionalState.BeingReinserted ? "They are returning to the plane." : "They are already above the plane."
      : undefined;
    return {
      id: resident.id,
      name: resident.name,
      sides: resident.sides,
      role: resident.role,
      intent: telemetry?.intent ?? "Beginning the day.",
      destination: telemetry?.destinationName ?? resident.role,
      state: dimensionalState === DimensionalState.OffPlane
        ? "Above the plane"
        : telemetry?.motionState === "controlled"
          ? "Under your control"
          : telemetry?.motionState?.replaceAll("-", " ") ?? "On the plane",
      followUnavailableReason: unavailableWhileCarrying ?? unavailableWhileDirecting,
      pickUpUnavailableReason: unavailableWhileCarrying ?? unavailableWhileDirecting ?? unavailableOffPlane
    };
  });
  const tourResident = residents.find((resident) => /soren abbott/i.test(resident.name)) ?? residents[0];
  const guidedBoundaryWall = world.walls.find((wall) => wall.buildingId === world.sealedRoomId && !wall.reopens && Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) >= 5.6)
    ?? world.walls.find((wall) => !wall.reopens && Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) >= 5.6);
  const guidedBoundaryTarget = guidedBoundaryWall ? { point: midpointOf(guidedBoundaryWall.a, guidedBoundaryWall.b) } : undefined;
  const pendingTargetOption = pendingWorldTarget
    ? placementTargets.find((target) => Math.hypot(target.point.x - pendingWorldTarget.x, target.point.z - pendingWorldTarget.z) < 0.05)
    : undefined;
  const debugTraffic = new URLSearchParams(window.location.search).has("debug");
  let contactPairs = 0;
  for (let first = 0; first < snapshot.residentCount; first += 1) {
    for (let second = first + 1; second < snapshot.residentCount; second += 1) {
      const firstOffset = first * snapshot.stride;
      const secondOffset = second * snapshot.stride;
      const distance = Math.hypot(snapshot.data[firstOffset] - snapshot.data[secondOffset], snapshot.data[firstOffset + 1] - snapshot.data[secondOffset + 1]);
      if (distance < (residents[first].radius + residents[second].radius) * 1.09 + 0.02) contactPairs += 1;
    }
  }

  const activationVerb = touchControlsEnabled ? "Tap" : "Click";
  const activeToolLabel = tool === "reinsert"
    ? pendingWorldTarget ? "Destination selected" : "Place citizen"
    : mode === "intervene"
      ? touchControlsEnabled ? "Tap an edge to edit it" : "Hover an edge to edit it"
      : "Choose a citizen action";

  const modeStatus = fallInProgress && carriedId !== null
    ? `Returning ${residents[carriedId]?.name ?? "citizen"} to Flatland · ${fallingAltitude.toFixed(1)} above the plane`
    : carriedId !== null
    ? tool === "reinsert"
      ? pendingWorldTarget
        ? `Precise destination selected · confirm placement`
        : `Precise placement · ${activationVerb.toLowerCase()} a green spot on the map`
      : `Carrying ${residents[carriedId]?.name ?? "citizen"} · moving above Flatland`
    : controlledId !== null
      ? `Control · ${camera === "native" ? "Native vision" : camera === "overhead" ? "Overhead" : "Chase"} · ${residents[controlledId]?.name ?? "citizen"}`
    : followedId !== null
      ? `${camera === "native" ? "Native vision" : "Follow"} · ${residents[followedId]?.name ?? "citizen"} · autonomous`
    : mode === "intervene"
        ? `Editing walls · ${activeToolLabel}`
        : mode === "join"
          ? "Citizen selected · choose Follow, Pick up, or Control"
          : selected
            ? `${selected.name} selected · F follow · E pick up · C control`
          : camera === "framed"
            ? "Framed town · orthographic survey"
            : "Town view · click a citizen · T edit walls · Ctrl/⌘ K find";

  const touchModeStatus = fallInProgress && carriedId !== null
    ? `Falling to Flatland · ${fallingAltitude.toFixed(1)} above the plane`
    : carriedId !== null
    ? tool === "reinsert"
      ? "Use joystick to move · tap a green spot to place"
      : "Fly with the joystick · Place here or Choose spot"
    : controlledId !== null
      ? `${camera === "native" ? "Native vision" : camera === "overhead" ? "Overhead" : "Chase"} view · joystick moves`
    : followedId !== null
      ? `${camera === "native" ? "Native vision" : "Follow view"} · routine remains autonomous`
      : mode === "intervene"
          ? activeToolLabel
          : mode === "join"
            ? "Choose Follow, Pick up, or Control"
            : selected
              ? "Choose an action below"
            : camera === "framed"
              ? "Framed town · drag to inspect"
              : "Drag to look · tap a citizen · pinch to zoom";
  const mobileHeaderContext = fallInProgress && carriedId !== null
    ? `Returning ${residents[carriedId]?.name ?? "citizen"}`
    : carriedId !== null
      ? tool === "reinsert" ? `Placing ${residents[carriedId]?.name ?? "citizen"}` : `Carrying ${residents[carriedId]?.name ?? "citizen"}`
      : controlledId !== null
        ? `Controlling ${residents[controlledId]?.name ?? "citizen"}`
        : followedId !== null
          ? `Following ${residents[followedId]?.name ?? "citizen"}`
          : planeToolsOpen
            ? "Editing walls"
            : selected
              ? `Selected ${selected.name}`
              : `Living town · ${timeLabel(snapshot.timeMinutes)}`;
  const desktopHeaderContext = fallInProgress && carriedId !== null
    ? `Returning ${residents[carriedId]?.name ?? "citizen"}`
    : carriedId !== null
      ? tool === "reinsert" ? `Placing ${residents[carriedId]?.name ?? "citizen"} precisely` : `Carrying ${residents[carriedId]?.name ?? "citizen"}`
      : controlledId !== null
        ? `Controlling ${residents[controlledId]?.name ?? "citizen"}`
        : followedId !== null
          ? `Following ${residents[followedId]?.name ?? "citizen"}`
          : planeToolsOpen
            ? "Editing walls"
            : selected
              ? `${selected.name} selected`
              : camera === "framed"
                ? "Framed town"
                : "Town view";
  const saveStateLabel = saveDirty ? "Unsaved changes" : savedAt ? "Saved" : "Autosave ready";
  const planeChangeNotice = planeToolsOpen && undoAvailable && [
    "The opening has been sealed.",
    "The sealed opening has been reopened.",
    "A new planar opening has been cut."
  ].includes(notice);

  const commitWorldPlacement = (target: Vec2) => {
    if (tool === "reinsert" && carriedId !== null) {
      if (controlledId === carriedId) setReleaseAfterDrop({ residentId: carriedId, to: "survey" });
      client.send({ type: "reinsert", residentId: carriedId, target });
    }
    setPendingWorldTarget(undefined);
  };

  const handleWorldToolTarget = (target: Vec2) => {
    if (tool !== "reinsert") return;
    commitWorldPlacement(target);
  };

  const handleBoundaryEdit = (action: BoundaryEditAction, target: Vec2) => {
    client.send({ type: action === "cut" ? "cut-at" : "seal-at", target });
    setMobileSheetSize("collapsed");
  };

  const togglePlacement = () => {
    const entering = tool !== "reinsert";
    setPendingWorldTarget(undefined);
    dispatch({ type: "set-tool", tool: entering ? "reinsert" : "carry" });
    if (entering) {
      if (touchControlsEnabled) {
        setNotice("");
        setMobileSheetSize("collapsed");
      } else {
        setNotice("Precise placement: move over the map and click a green target. Escape cancels.");
        requestAnimationFrame(() => document.getElementById("flatworld-canvas")?.focus());
      }
    } else {
      if (!touchControlsEnabled) {
        setMobileSheetSize("expanded");
        setNotice("Precise placement cancelled. The citizen remains in hand.");
      } else setNotice("");
    }
  };

  let desktopCommandTitle = "Explore Flatland";
  let desktopCommandHint = "Navigate the town directly; citizen and wall actions live in the header.";
  let desktopCommands: DesktopCommand[] = [
    { id: "move", label: "Move view", shortcut: "WASD" },
    { id: "rotate", label: "Rotate", shortcut: "Right drag" },
    { id: "zoom", label: "Zoom", shortcut: "Wheel" }
  ];

  if (planeToolsOpen) {
    desktopCommandTitle = "Edit Flatland’s boundaries";
    desktopCommandHint = "Hover a wall or opening; its action stays put while you move to it.";
    desktopCommands = [
      { id: "edge", label: "Choose edge", shortcut: "Mouse" },
      { id: "undo", label: "Undo", shortcut: "Ctrl Z", onActivate: () => client.send({ type: "undo-intervention" }), disabled: !undoAvailable },
      { id: "reset", label: "Reset all", onActivate: () => dispatch({ type: "set-overlay", overlay: "confirm-reset" }) }
    ];
  }

  const startGuidedVisit = () => {
    rememberWelcomeSeen();
    tourMutationApplied.current = false;
    tourDirtyBefore.current = saveDirty;
    setPendingWorldTarget(undefined);
    setGuideMoment(null);
    dispatch({ type: "start-tour" });
    setNotice("A short visit will introduce the town view, Find citizen, Native vision, and Edit walls.");
  };

  const finishGuidedVisit = () => {
    tourStepRef.current = "idle";
    rememberTourCompletion();
    dispatch({ type: "cancel-tour" });
    dispatch({ type: "select", residentId: null });
    setPendingWorldTarget(undefined);
    setNotice("Guided visit complete. The town is yours to explore.");
  };

  const advanceFromNativeVisit = () => {
    closeNative();
    dispatch({ type: "set-mode", mode: "intervene" });
    dispatch({ type: "set-tour-step", step: "plane-preview" });
  };

  const handleTourPrimary = () => {
    if (experience.tourStep === "survey") {
      frameTown();
      dispatch({ type: "set-tour-step", step: "people" });
      dispatch({ type: "set-overlay", overlay: "people" });
      return;
    }
    if (experience.tourStep === "people" && tourResident) {
      dispatch({ type: "set-overlay", overlay: "none" });
      selectResident(tourResident.id);
      dispatch({ type: "set-tour-step", step: "follow" });
      return;
    }
    if (experience.tourStep === "follow" && tourResident) {
      followResident(tourResident.id);
      dispatch({ type: "set-tour-step", step: "native" });
      return;
    }
    if (experience.tourStep === "native") {
      if (camera !== "native") {
        dispatch({ type: "set-camera", cameraMode: "native" });
      } else {
        advanceFromNativeVisit();
      }
      return;
    }
    if (experience.tourStep === "plane-preview") {
      if (guidedBoundaryTarget) handleBoundaryEdit("cut", guidedBoundaryTarget.point);
      return;
    }
    if (experience.tourStep === "undo") {
      guidedUndoRestoreDirty.current = tourDirtyBefore.current;
      client.send({ type: "undo-intervention" });
      return;
    }
    if (experience.tourStep === "complete") finishGuidedVisit();
  };

  const guidedVisitPrimary: GuidedVisitAction = {
    label: experience.tourStep === "survey"
      ? "Frame the town"
      : experience.tourStep === "people"
        ? `Choose ${tourResident?.name ?? "a citizen"}`
        : experience.tourStep === "follow"
          ? `Follow ${tourResident?.name ?? "this citizen"}`
          : experience.tourStep === "native"
            ? camera === "native" ? "Return above" : "Enter native vision"
            : experience.tourStep === "plane-preview"
              ? "Open the boundary"
              : experience.tourStep === "undo"
                ? "Undo the change"
                : "Explore freely",
    onAction: handleTourPrimary,
    disabled: (experience.tourStep === "people" || experience.tourStep === "follow") && !tourResident
      || experience.tourStep === "plane-preview" && !guidedBoundaryTarget
  };

  const createResident = (profile: ResidentProfile) => {
    if (creatorPending) return;
    setCreatorError(undefined);
    setCreatorPending(true);
    client.send({ type: "create-resident", profile, requestId: client.nextRequestId() });
  };

  const closeCreator = () => {
    if (creatorPending) return;
    setCreatorError(undefined);
    dispatch({ type: "set-mode", mode: "join" });
  };

  const closeHelp = () => setHelpOpen(false);

  const restoreSave = async () => {
    try {
      const loaded = await loadWorld();
      if (!loaded) return setNotice("No remembered town was found in this browser.");
      if (loaded.kind === "legacy") return setNotice("This save predates the living town and cannot enter the current topology.");
      client.send({ type: "load-save", save: loaded.save.simulation });
      const session = loaded.save.session;
      const rememberedFollow = session.followedResidentId ?? session.lastControlledResidentId;
      dispatch({
        type: "restore-session",
        state: {
          mode: session.mode,
          cameraMode: rememberedFollow !== null ? "follow" : session.cameraMode === "framed" ? "framed" : "survey",
          selectedResidentId: session.selectedResidentId,
          followedResidentId: rememberedFollow,
          lastControlledResidentId: session.lastControlledResidentId,
          playerResidentIds: session.playerResidentIds,
          projection: session.cameraPose?.projection ?? "perspective",
          quality: session.quality
        }
      });
      if (session.cameraPose) {
        cameraPose.current = session.cameraPose;
        setRestorePose(session.cameraPose);
        setRestorePoseSignal((signal) => signal + 1);
      }
      setSavedAt(loaded.save.savedAt);
      setSaveDirty(false);
      setNotice(loaded.kind === "v2" ? "Your earlier town has been migrated into the new traffic system." : "The remembered town and its routines have returned.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The browser could not recall this town.");
    }
  };

  const requestRestoreSave = () => {
    if (!savedAt) {
      setNotice("No remembered town was found in this browser.");
      return;
    }
    if (saveDirty) dispatch({ type: "set-overlay", overlay: "confirm-recall" });
    else void restoreSave();
  };

  const startFreshTown = async () => {
    try {
      rememberWelcomeSeen();
      await clearSavedWorld();
      window.location.reload();
    } catch (error) {
      dispatch({ type: "set-overlay", overlay: "none" });
      setNotice(error instanceof Error ? error.message : "The remembered town could not be cleared.");
    }
  };

  const resetPlaneChanges = () => {
    dispatch({ type: "set-overlay", overlay: "none" });
    client.send({ type: "reset-plane" });
  };

  const returnCarriedCitizen = () => {
    const origin = carryOrigin.current;
    if (carriedId === null || !origin || origin.residentId !== carriedId) {
      setNotice("The pickup point is no longer available; place the citizen at a clear destination.");
      dispatch({ type: "set-overlay", overlay: "none" });
      return;
    }
    dispatch({ type: "set-overlay", overlay: "none" });
    beginDrop({ x: origin.x, z: origin.z }, carryExitTo.current);
  };

  const beginObservation = () => {
    rememberWelcomeSeen();
    dispatch({ type: "cancel-intro" });
    setGuideMoment("select");
  };

  const selectResident = (residentId: number) => {
    if (carriedId !== null && carriedId !== residentId) {
      setNotice(`Place ${residents[carriedId]?.name ?? "the citizen"} before selecting someone else.`);
      return;
    }
    if (mode === "intervene") {
      setPendingWorldTarget(undefined);
      dispatch({ type: "set-mode", mode: "explore" });
    }
    if (followedId !== null && followedId !== residentId) dispatch({ type: "stop-follow" });
    dispatch({ type: "select", residentId });
    if (touchControlsEnabled) setMobileSheetSize("expanded");
    if (experience.introActive) dispatch({ type: "cancel-intro" });
    if (experience.introActive || guideMoment === "select") setGuideMoment(null);
  };

  const cameraInteraction = () => {
    if (experience.introActive) beginObservation();
    else if (camera === "framed") dispatch({ type: "set-camera", cameraMode: "survey" });
  };

  const locateResident = (residentId: number) => {
    if ((carriedId !== null || controlledId !== null) && activeResidentId !== residentId) {
      setNotice(carriedId !== null
        ? "Place the carried citizen before locating someone else."
        : "Release the controlled citizen before locating someone else.");
      return;
    }
    if (mode !== "explore" && controlledId === null) dispatch({ type: "set-mode", mode: "explore" });
    if (followedId !== null) dispatch({ type: "stop-follow" });
    dispatch({ type: "set-overlay", overlay: "none" });
    selectResident(residentId);
    const offset = residentId * snapshot.stride;
    const x = snapshot.data[offset];
    const z = snapshot.data[offset + 1];
    const pose: CameraPoseSave = {
      position: [x + 8, 8.5, z + 11],
      target: [x, 0, z],
      projection: "perspective"
    };
    setRestorePose(pose);
    setRestorePoseSignal((signal) => signal + 1);
  };

  const focusEvent = (event: SimEvent) => {
    dispatch({ type: "set-overlay", overlay: "none" });
    const residentId = event.actors.find((id) => residents[id]);
    if (residentId !== undefined) {
      locateResident(residentId);
      return;
    }
    const venue = event.venueId === undefined
      ? undefined
      : world.buildings.find((building) => building.id === event.venueId)
        ?? world.publicPlaces.find((place) => String(place.id) === String(event.venueId));
    const target = event.position ?? venue?.center;
    if (!target) {
      setNotice("This Gazette entry has no location to frame.");
      return;
    }
    if (mode !== "explore") dispatch({ type: "set-mode", mode: "explore" });
    const pose: CameraPoseSave = {
      position: [target.x + 10, 10, target.z + 13],
      target: [target.x, 0, target.z],
      projection: "perspective"
    };
    setRestorePose(pose);
    setRestorePoseSignal((signal) => signal + 1);
  };

  const confirmationOpen = overlay.startsWith("confirm-");
  const blockingDialog = helpOpen || bookOpen || aboutOpen || panel === "create" || confirmationOpen;
  const baseLayerInactive = blockingDialog || experience.introActive || camera === "native";
  const desktopCitizenActionsVisible = !touchControlsEnabled
    && !experience.introActive
    && actionSection === "citizen"
    && Boolean(selected || panel === "choose" || controlledId !== null);
  const awaitingWorldTarget = mode === "intervene" || tool === "reinsert";

  return (
    <main className={`app-shell ${touchControlsEnabled ? "has-touch-controls" : ""}`}>
      <div className="base-layer" inert={baseLayerInactive} aria-hidden={baseLayerInactive}>
      <div className={`world-canvas ${awaitingWorldTarget ? "is-tool-active" : ""}`} inert={experience.introActive}>
        <FlatworldScene
          world={world}
          residents={residents}
          snapshot={snapshot}
          experience={sceneExperience}
          cameraInput={cameraInput}
          quality={experience.quality}
          renderActive={camera !== "native" && !bookOpen && !aboutOpen}
          frameSignal={frameSignal}
          resetSignal={resetSignal}
          restorePose={restorePose}
          restorePoseSignal={restorePoseSignal}
          previewTarget={pendingWorldTarget ?? (experience.tourStep === "plane-preview" ? guidedBoundaryTarget?.point : undefined)}
          onSelect={selectResident}
          onWorldPoint={handleWorldToolTarget}
          onBoundaryEdit={handleBoundaryEdit}
          onCameraInteraction={cameraInteraction}
          onCameraPose={(pose) => { cameraPose.current = pose; }}
          activationVerb={activationVerb}
        />
      </div>

      <header className="masthead">
        <div className="masthead-identity">
          <div className="brand">
            <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <path className="brand-mark__frame" d="M24 2.5 39.2 8.8 45.5 24l-6.3 15.2L24 45.5 8.8 39.2 2.5 24 8.8 8.8Z" />
              <path className="brand-mark__plane" d="m7.5 27 16.5-10 16.5 10L24 37Z" />
              <path className="brand-mark__axis" d="M24 17v20M7.5 27h33" />
              <path className="brand-mark__citizen" d="m24 19 6.3 3.7v7.1L24 33.5l-6.3-3.7v-7.1Z" />
              <circle className="brand-mark__point" cx="24" cy="26.2" r="1.65" />
            </svg>
            <div>
              <p>Flatland</p>
              <span className="brand-copy-desktop">
                <span className="masthead-status-time"><Clock3 aria-hidden="true" />{timeLabel(snapshot.timeMinutes)}</span>
                <span className="masthead-status-context">{desktopHeaderContext}</span>
                {paused && <span className="masthead-status-flag">Paused</span>}
                {timeScale !== 1 && <span className="masthead-status-flag">{timeScale}×</span>}
                <span className={`masthead-save-state ${saveDirty ? "is-dirty" : ""}`}>{saveStateLabel}</span>
              </span>
              <span className="brand-copy-mobile">{mobileHeaderContext}</span>
            </div>
          </div>
          <div className="header-reference-actions">
            <button
              type="button"
              className={`header-book-action ${bookOpen ? "is-active" : ""}`}
              aria-label={bookOpen ? "Close the book" : "Read Flatland"}
              aria-expanded={bookOpen}
              aria-controls="flatland-book-reader"
              title="Read the complete book"
              onClick={() => bookOpen ? dispatch({ type: "set-overlay", overlay: "none" }) : openBook()}
            >
              <BookOpenText aria-hidden="true" />
              <span>Read Flatland</span>
            </button>
            <button
              type="button"
              className={aboutOpen ? "is-active" : ""}
              aria-label={aboutOpen ? "Close source and context notes" : "About the project and its source"}
              aria-expanded={aboutOpen}
              aria-controls="flatland-adaptation-context"
              title="Source and context"
              onClick={() => dispatch({ type: "set-overlay", overlay: aboutOpen ? "none" : "about" })}
            >
              <Info aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav
          className={`primary-navigation${touchControlsEnabled && planeToolsOpen ? " is-wall-task" : ""}`}
          aria-label={touchControlsEnabled && planeToolsOpen ? "Wall editing actions" : "World actions"}
          inert={experience.introActive}
          aria-hidden={experience.introActive}
        >
          {touchControlsEnabled && planeToolsOpen ? (
            <>
              <button type="button" disabled={!undoAvailable} onClick={() => client.send({ type: "undo-intervention" })}>
                <RotateCcw aria-hidden="true" /><span>Undo</span>
              </button>
              <button type="button" className="is-danger" onClick={() => dispatch({ type: "set-overlay", overlay: "confirm-reset" })}>
                <RefreshCcw aria-hidden="true" /><span>Reset</span>
              </button>
              <button type="button" className="is-active" aria-label="Finish editing walls" onClick={openPlaneTools}>
                <Check aria-hidden="true" /><span>Done</span>
              </button>
            </>
          ) : (
            <>
              <button
                ref={peopleButton}
                type="button"
                className={peopleOpen ? "is-active" : ""}
                aria-pressed={peopleOpen}
                aria-expanded={peopleOpen}
                aria-controls="people-directory"
                onClick={openPeopleDirectory}
              >
                <Search aria-hidden="true" /><span>Find citizen</span><kbd>Ctrl K</kbd>
              </button>
              <button
                type="button"
                aria-label={planeToolsOpen ? "Finish editing walls" : "Edit walls"}
                aria-pressed={planeToolsOpen}
                aria-disabled={controlledId !== null || carriedId !== null || undefined}
                aria-describedby={controlledId !== null || carriedId !== null ? "plane-tools-unavailable" : undefined}
                className={planeToolsOpen ? "is-active" : ""}
                title={controlledId !== null || carriedId !== null
                  ? "Release or place the citizen before changing the plane"
                  : planeToolsOpen ? "Finish editing Flatland's boundaries" : "Open tools for changing Flatland's boundaries"}
                onClick={openPlaneTools}
              >
                <Scissors aria-hidden="true" /><span>{planeToolsOpen ? "Done editing" : "Edit walls"}</span><kbd>T</kbd>
              </button>
              {(controlledId !== null || carriedId !== null) && (
                <span id="plane-tools-unavailable" className="sr-only">Release or place the citizen before changing the plane.</span>
              )}
            </>
          )}
        </nav>
        <div className="header-actions">
          <button
            ref={overflowButton}
            className="town-menu-button"
            aria-label={overflowOpen ? "Close town menu" : "Open town controls"}
            aria-expanded={overflowOpen}
            aria-controls="town-controls"
            disabled={experience.introActive}
            onClick={() => setOverflowOpen((open) => !open)}
          >{overflowOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <div className="mode-status">
        <span className="status-pill" aria-hidden="true"><Clock3 />{timeLabel(snapshot.timeMinutes)}</span>
        {paused && <span className="status-pill is-paused">Paused</span>}
        {timeScale !== 1 && <span className="status-pill">{timeScale}×</span>}
        <p aria-hidden="true"><span className="status-copy-desktop">{modeStatus}</span><span className="status-copy-touch">{touchModeStatus}</span></p>
        <span className={`save-state ${saveDirty ? "is-dirty" : ""}`}>{saveDirty ? "Unsaved changes" : savedAt ? "Saved" : "Autosave ready"}</span>
      </div>
      <p className="sr-only" aria-live="polite">{touchControlsEnabled ? touchModeStatus : modeStatus}</p>
      {!touchControlsEnabled && !experience.introActive && camera !== "native" && overlay === "none" && !desktopCitizenActionsVisible && (
        <DesktopCommandBar
          title={desktopCommandTitle}
          hint={desktopCommandHint}
          commands={desktopCommands}
          hasSidePanel={false}
          onOpenHelp={() => setHelpOpen(true)}
        />
      )}
      {notice && (
        <div className={`notice-toast${planeChangeNotice ? " is-plane-change" : ""}`} role={/could not|cannot|failed|blocked|unavailable/i.test(notice) ? "alert" : "status"}>
          <p>{notice}</p>
          <div className="notice-toast__actions">
            {planeChangeNotice && <button type="button" className="notice-toast__undo" onClick={() => client.send({ type: "undo-intervention" })}>Undo</button>}
            <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X /></button>
          </div>
        </div>
      )}
      {simulationLifecycle.status === "error" && (
        <div className="simulation-error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <p><strong>The living town stopped.</strong><span>{simulationLifecycle.message}</span></p>
          <button type="button" onClick={() => client.restart()}>Restart simulation</button>
        </div>
      )}
      {experience.introActive && <button
        type="button"
        className="world-context-label"
        aria-label="Read the complete book Flatland"
        aria-haspopup="dialog"
        onClick={() => openBook()}
      >
        <span className="world-context-copy">
          <span className="world-context-kicker">An overhead survey of</span>
          <strong className="world-context-title">{world.cartouche.title}</strong>
          <span className="world-context-subtitle">{world.cartouche.subtitle}</span>
          <small>{world.cartouche.author} · {world.cartouche.publication.replace("FIRST PUBLISHED ", "")}</small>
        </span>
        <span className="world-context-read"><BookOpenText aria-hidden="true" /><span>Read the book</span></span>
      </button>}

      {!experience.introActive && guideMoment === "select" && !selected && mode === "explore" && (
        <aside className="discovery-guide parchment-panel" aria-label="Exploration suggestion">
          <div className="panel-heading"><div><p className="eyebrow">First observation</p><h2>Every shape has somewhere to be.</h2></div><button aria-label="Dismiss exploration suggestion" onClick={() => setGuideMoment(null)}><X /></button></div>
          <p>Select any moving citizen to see their occupation, present intention, and destination.</p>
        </aside>
      )}

      {peopleOpen && !experience.introActive && (
        <div id="people-directory" className="people-directory-layer">
          <PeopleDirectory
            residents={directoryResidents}
            activeResidentId={activeResidentId ?? experience.selectedResidentId}
            followedResidentId={followedId}
            controlledResidentId={controlledId}
            onLocate={locateResident}
            onFollow={(residentId) => {
              if (followedId === residentId) stopFollowing();
              else followResident(residentId);
              dispatch({ type: "set-overlay", overlay: "none" });
            }}
            onPickUp={quickPickUpResident}
            onCreateCitizen={() => {
              dispatch({ type: "set-overlay", overlay: "none" });
              dispatch({ type: "open-creator" });
            }}
            onClose={() => dispatch({ type: "set-overlay", overlay: "none" })}
            autoFocusSearch={!touchControlsEnabled}
            createUnavailableReason={carriedId !== null
              ? "Place the carried citizen first."
              : controlledId !== null ? "Release the controlled citizen first." : undefined}
          />
        </div>
      )}

      {!experience.introActive
        && actionSection === "citizen"
        && (selected || panel === "choose" || controlledId !== null)
        && joinResident
        && showCitizenActionDrawer(touchControlsEnabled, actionStage)
        && (
        <section
          className={`join-drawer action-drawer parchment-panel is-${actionStage} sheet-${mobileSheetSize}`}
          aria-label="Citizen actions"
          inert={overlay !== "none"}
          aria-hidden={overlay !== "none"}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{actionStage === "carry" ? fallInProgress ? "Returning to Flatland" : "You are carrying" : actionStage === "direct" ? "You have control" : "Citizen in view"}</p>
              <h2>{joinResident.name}</h2>
            </div>
            <div className="panel-heading-actions">
              {touchControlsEnabled && actionStage !== "choose" && <button
                type="button"
                className="mobile-sheet-size"
                aria-label={mobileSheetSize === "expanded" ? "Minimize action panel" : "Expand action panel"}
                title={mobileSheetSize === "expanded" ? "Minimize panel" : "Expand panel"}
                aria-expanded={mobileSheetSize === "expanded"}
                onClick={() => setMobileSheetSize((size) => size === "expanded" ? "collapsed" : "expanded")}
              >
                {mobileSheetSize === "expanded"
                  ? <Minimize2 aria-hidden="true" />
                  : <Maximize2 aria-hidden="true" />}
                <span>{mobileSheetSize === "expanded" ? "Hide options" : "Options"}</span>
              </button>}
              {actionStage === "choose" && <button aria-label="Close citizen actions" onClick={() => { dispatch({ type: "select", residentId: null }); if (mode !== "explore") switchMode("explore"); }}><X /></button>}
            </div>
          </div>
          <div
            className="action-drawer__content"
            inert={touchControlsEnabled && mobileSheetSize === "collapsed"}
            aria-hidden={touchControlsEnabled && mobileSheetSize === "collapsed"}
          >
          {!touchControlsEnabled && <p>{joinResident.sides}-sided {joinResident.role}</p>}
          <CitizenActionPanel
              resident={joinResident}
              residents={residents}
              stage={actionStage}
              summary={motionDescription(selectedTelemetry)}
              destination={selectedTelemetry?.destinationName ?? joinResident.role}
              dimensionalState={selectedState}
              followed={followedId === joinResident.id}
              camera={camera}
              tool={tool}
              blockedReason={selectedTelemetry?.blockedReason ?? undefined}
              releasePending={releasePending}
              falling={fallInProgress}
              compactSelection={touchControlsEnabled}
              onSelect={selectResident}
              onFollow={() => followResident(joinResident.id)}
              onStopFollowing={stopFollowing}
              onTakeControl={() => takeControl(joinResident.id)}
              onOpenCreator={() => dispatch({ type: "open-creator" })}
              onSetCamera={(cameraMode) => dispatch({ type: "set-camera", cameraMode })}
              onRecover={() => client.send({ type: "recover-resident", residentId: joinResident.id })}
              onPickUp={() => quickPickUpResident(joinResident.id)}
              onRelease={releaseControl}
              onDrop={dropLiftedCitizen}
              showDropAction={!touchControlsEnabled}
              showDirectActions={!touchControlsEnabled}
              onTogglePlacement={togglePlacement}
            />
          {!touchControlsEnabled && tool === "reinsert" && (
            <div className={`tool-targeting${pendingWorldTarget ? " has-target" : ""}`} aria-label="Precise placement">
              <p className="tool-targeting__instruction" role="status">
                <strong>{pendingWorldTarget
                  ? `${pendingTargetOption?.label ?? "That map position"} is selected.`
                  : touchControlsEnabled
                    ? "Tap a clear spot on the map."
                    : "Move across the map, then click a green target."}</strong>
                <span>{pendingWorldTarget
                  ? "Confirm to return the citizen there."
                  : "Green fits. Red overlaps a wall."}</span>
              </p>
              <label htmlFor="named-tool-target">Or choose a named place</label>
              <select
                id="named-tool-target"
                value={pendingTargetOption?.id ?? ""}
                onChange={(event) => {
                  const target = placementTargets.find((candidate) => candidate.id === event.target.value);
                  setPendingWorldTarget(target ? target.point : undefined);
                }}
              >
                <option value="">Choose a named place…</option>
                {placementTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
              </select>
              {pendingWorldTarget ? (
                <div className="tool-centre-actions">
                  <button className="button-primary" onClick={() => commitWorldPlacement(pendingWorldTarget)}>Place at selected spot</button>
                  <button onClick={() => setPendingWorldTarget(undefined)}>Choose again</button>
                </div>
              ) : (
                <div className="tool-centre-actions">
                  <button onClick={togglePlacement}>Cancel precise placement</button>
                </div>
              )}
            </div>
          )}
          </div>
        </section>
      )}

      {touchControlsEnabled
        && followedResident
        && !selected
        && controlledId === null
        && carriedId === null
        && camera !== "native"
        && overlay === "none"
        && experience.tourStep === "idle"
        && (
          <MobileFollowBar
            resident={followedResident}
            onOpenActions={() => {
              dispatch({ type: "select", residentId: followedResident.id });
              setMobileSheetSize("expanded");
            }}
            onPickUp={() => quickPickUpResident(followedResident.id)}
            onNativeView={() => dispatch({ type: "set-camera", cameraMode: "native" })}
            onStop={stopFollowing}
          />
        )}

      <aside id="flatworld-gazette" className={`gazette parchment-panel ${gazetteOpen ? "is-open" : ""} ${experience.introActive ? "is-intro" : ""}`} aria-label="The Flatland Gazette" inert={experience.introActive}>
        <button
          className="gazette-title"
          aria-expanded={gazetteOpen}
          aria-controls="gazette-entries"
          onClick={() => setGazetteOpen((open) => !open)}
        >
          <BookOpenText aria-hidden="true" />
          <span>The Flatland Gazette<small>{latestEvent?.summary ?? "Morning edition"}</small></span>
        </button>
        {gazetteOpen && (
          <ol id="gazette-entries">
            {events.slice(-12).reverse().map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => focusEvent(event)}>
                  <time>{event.timeMinutes === undefined ? "Earlier" : `Day ${event.day ?? snapshot.day} · ${timeLabel(event.timeMinutes)}`}</time>
                  <span>{event.summary}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </aside>

      <TownMenu
        ref={townControls}
        open={overflowOpen}
        introActive={experience.introActive}
        hasSidePanel={false}
        mode={mode}
        projection={experience.projection}
        camera={camera}
        controlled={controlledId !== null}
        carrying={carriedId !== null}
        nativeViewAvailable={nativeResidentId !== null}
        paused={paused}
        timeScale={timeScale}
        quality={experience.quality}
        savedAt={savedAt}
        saveDirty={saveDirty}
        onClose={() => setOverflowOpen(false)}
        onFrameTown={frameTown}
        onToggleProjection={toggleProjection}
        onSetCamera={(cameraMode) => dispatch({ type: "set-camera", cameraMode })}
        onTogglePaused={() => {
          setPaused((value) => !value);
          client.send({ type: "set-clock", paused: !paused });
        }}
        onSetTimeScale={(value) => {
          setTimeScale(value);
          client.send({ type: "set-clock", timeScale: value });
        }}
        onSetQuality={(quality) => dispatch({ type: "set-quality", quality })}
        onOpenGazette={() => dispatch({ type: "set-overlay", overlay: "gazette" })}
        onReplayGuidedVisit={startGuidedVisit}
        onSave={() => { void storeSave(); }}
        onRecall={requestRestoreSave}
        onStartNewTown={() => dispatch({ type: "set-overlay", overlay: "confirm-new-town" })}
        onOpenHelp={() => dispatch({ type: "set-overlay", overlay: "help" })}
        onOpenAbout={() => dispatch({ type: "set-overlay", overlay: "about" })}
      />

      {debugTraffic && (
        <aside className="traffic-debug" aria-label="Traffic diagnostics">
          <strong>Traffic diagnostics</strong>
          <span>{contactPairs} contact pairs</span>
          <span>{snapshot.telemetry.filter((resident) => resident.motionState === "waiting-capacity").length} waiting for capacity</span>
          <span>{snapshot.telemetry.filter((resident) => resident.motionState === "waiting-portal").length} yielding at doors</span>
          <span>{snapshot.telemetry.filter((resident) => resident.motionState === "blocked").length} replanning</span>
          <span>tick {snapshot.tick}</span>
        </aside>
      )}
      </div>

      {experience.introActive && !blockingDialog && (
        <WelcomeDialog
          hasSavedTown={Boolean(savedAt)}
          onContinue={savedAt
            ? () => { rememberWelcomeSeen(); requestRestoreSave(); }
            : beginObservation}
          onStartNewTown={() => dispatch({ type: "set-overlay", overlay: "confirm-new-town" })}
          onStartGuidedTour={startGuidedVisit}
          onReadBook={() => openBook()}
          onOpenAnalogy={() => dispatch({ type: "set-overlay", overlay: "about" })}
        />
      )}

      <div className="embodied-layer" inert={blockingDialog || experience.introActive} aria-hidden={blockingDialog || experience.introActive}>
        {camera === "native" && nativeResidentId !== null && (
          <NativeVision
            world={world}
            residents={residents}
            snapshot={snapshot}
            selectedId={nativeResidentId}
            onGuidedView={experience.tourStep === "native" ? advanceFromNativeVisit : closeNative}
            onOverheadView={controlledId !== null
              ? () => dispatch({ type: "set-camera", cameraMode: "overhead" })
              : closeNative}
            onStopFollowing={controlledId === null ? stopFollowing : undefined}
            returnLabel={controlledId !== null ? "Return to chase" : "Return to follow"}
            showOverheadView={controlledId !== null}
          />
        )}
        {!blockingDialog && touchControlsEnabled && (
          carriedId !== null
            ? fallInProgress
              ? (
                <div className="touch-descent-status" role="status" aria-label="Citizen falling back to Flatland">
                  <span aria-hidden="true">↓</span>
                  <strong>Falling</strong>
                  <small>{fallingAltitude.toFixed(1)} above the plane</small>
                </div>
              )
              : (
                <TouchJoystick
                  label="Lifted citizen touch controls"
                  moveLabel="Fly with citizen"
                  actionLabel="Faster"
                  onInput={setCarryTouch}
                  onAltitudeInput={setCarryAltitude}
                  onDrop={dropLiftedCitizen}
                  onPrecisePlace={togglePlacement}
                  precisePlaceLabel={tool === "reinsert" ? "Cancel exact" : "Choose spot"}
                  precisePlaceActive={tool === "reinsert"}
                />
              )
            : controlledId !== null && (
              <TouchJoystick
                key={camera === "native" ? "native-steering" : "world-direction"}
                mode={camera === "native" ? "steering" : "directional"}
                label={camera === "native" ? "Native vision steering controls" : "Citizen touch controls"}
                moveLabel={camera === "native" ? "Steer citizen" : "Move citizen"}
                onInput={sendActiveControlInput}
                onPickUp={() => quickPickUpResident(controlledId)}
                pickUpDisabled={selectedState !== DimensionalState.OnPlane}
                onView={() => dispatch({ type: "set-camera", cameraMode: camera === "native" ? "chase" : "native" })}
                viewLabel={camera === "native" ? "Chase view" : "Their view"}
                onRelease={() => releaseControl()}
                releasePending={releasePending}
              />
            )
        )}
      </div>

      {!experience.introActive && experience.tourStep !== "idle" && (
        <GuidedVisit
          step={experience.tourStep}
          primaryAction={guidedVisitPrimary}
          onSkip={cancelGuidedVisit}
          onReplay={startGuidedVisit}
        />
      )}

      {panel === "create" && <CharacterCreator onCreate={createResident} onClose={closeCreator} error={creatorError} pending={creatorPending} avoidInitialInputFocus={touchControlsEnabled} />}
      {helpOpen && <ControlsDialog onClose={closeHelp} />}
      {aboutOpen && (
        <AdaptationContext
          onClose={() => dispatch({ type: "set-overlay", overlay: "none" })}
          onReadBook={openBook}
        />
      )}
      {bookOpen && (
        <BookReader
          initialChapter={bookStartChapter}
          onClose={() => dispatch({ type: "set-overlay", overlay: "none" })}
          onOpenContext={() => dispatch({ type: "set-overlay", overlay: "about" })}
        />
      )}
      {overlay === "confirm-recall" && (
        <ConfirmDialog
          eyebrow="Recall saved town"
          title="Replace the current town?"
          confirmLabel="Recall save"
          destructive
          onClose={() => {
            dispatch({ type: "set-overlay", overlay: "none" });
            requestAnimationFrame(() => {
              if (experience.introActive) document.getElementById("flatworld-intro-primary")?.focus();
              else overflowButton.current?.focus();
            });
          }}
          onConfirm={() => {
            dispatch({ type: "set-overlay", overlay: "none" });
            void restoreSave();
          }}
        >
          <p>Changes since the last save will be replaced. This cannot be undone.</p>
        </ConfirmDialog>
      )}
      {overlay === "confirm-reset" && (
        <ConfirmDialog
          eyebrow="Edit walls"
          title="Restore the original town boundaries?"
          confirmLabel="Reset plane"
          destructive
          onClose={() => dispatch({ type: "set-overlay", overlay: "none" })}
          onConfirm={resetPlaneChanges}
        >
          <p>Every wall and doorway will return to the original town plan. The Closed Room will be sealed again, and ordinary doorways—including the Archive—will reopen.</p>
        </ConfirmDialog>
      )}
      {overlay === "confirm-new-town" && (
        <ConfirmDialog
          eyebrow="Town menu"
          title="Start a new town?"
          confirmLabel="Clear save and restart"
          destructive
          onClose={() => {
            dispatch({ type: "set-overlay", overlay: "none" });
            requestAnimationFrame(() => {
              if (experience.introActive) document.getElementById("flatworld-intro-primary")?.focus();
              else overflowButton.current?.focus();
            });
          }}
          onConfirm={() => { void startFreshTown(); }}
        >
          <p>The remembered town in this browser will be deleted before Flatland restarts.</p>
        </ConfirmDialog>
      )}
      {overlay === "confirm-carry-exit" && (
        <ConfirmDialog
          eyebrow="Citizen above the plane"
          title="Where should they return?"
          confirmLabel="Return to pickup point"
          cancelLabel="Keep carrying"
          onClose={() => dispatch({ type: "set-overlay", overlay: "none" })}
          onConfirm={returnCarriedCitizen}
        >
          <p>Return the citizen to where they were lifted, place them at the current clear position, or continue carrying.</p>
          <button
            type="button"
            className="button-quiet confirm-inline-action"
            onClick={() => {
              dispatch({ type: "set-overlay", overlay: "none" });
              beginDrop(undefined, carryExitTo.current);
            }}
          >
            Place at current position
          </button>
        </ConfirmDialog>
      )}
    </main>
  );
}
