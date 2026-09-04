/// <reference lib="webworker" />
import type { SimCommand, WorkerMessage } from "../types";
import { FlatworldSimulation } from "./simulation";

const scope = self as unknown as DedicatedWorkerGlobalScope;
let simulation = new FlatworldSimulation(1884);
let lastEventCount = 0;
let initialized = false;
const STEP_INTERVAL_MS = 1000 / 30;
const SNAPSHOT_INTERVAL_MS = 1000 / 15;

function post(message: WorkerMessage, transfer: Transferable[] = []) {
  scope.postMessage(message, transfer);
}

function snapshot() {
  const current = simulation.snapshot();
  post({
    type: "snapshot",
    tick: current.tick,
    timeMinutes: current.timeMinutes,
    day: current.day,
    stride: current.stride,
    residentCount: current.residentCount,
    telemetry: current.telemetry,
    buffer: current.data.buffer as ArrayBuffer
  }, [current.data.buffer as ArrayBuffer]);
}

function events() {
  if (simulation.events.length === lastEventCount) return;
  post({ type: "events", events: simulation.events });
  lastEventCount = simulation.events.length;
}

function ready() {
  post({ type: "ready", world: simulation.world, residents: simulation.getResidentStatics(), events: simulation.events });
  lastEventCount = simulation.events.length;
}

function result(command: SimCommand["type"], response: { ok: boolean; message: string }, residentId?: number, requestId?: number) {
  post({ type: "command-result", command, ok: response.ok, message: response.message, residentId, requestId });
}

function publishMutation(response: { ok: boolean }) {
  if (!response.ok) return;
  snapshot();
  events();
}

scope.onmessage = ({ data: command }: MessageEvent<SimCommand>) => {
  switch (command.type) {
    case "initialize":
      simulation.initialize(command.seed);
      initialized = true;
      ready();
      snapshot();
      break;
    case "begin-resident-control": {
      const response = simulation.beginControl(command.residentId);
      result(command.type, response, command.residentId, command.requestId);
      publishMutation(response);
      break;
    }
    case "set-resident-input":
      simulation.setInput(command.residentId, command.move, command.sprint, command.sequence, command.sentAt);
      break;
    case "set-resident-steering":
      simulation.setSteeringInput(command.residentId, command.forward, command.turn, command.sprint, command.sequence, command.sentAt);
      break;
    case "end-resident-control": {
      const response = simulation.endControl(command.residentId, command.resumeRoutine);
      result(command.type, response, command.residentId, command.requestId);
      publishMutation(response);
      break;
    }
    case "recover-resident": {
      const response = simulation.recoverResident(command.residentId);
      result(command.type, response, command.residentId);
      publishMutation(response);
      break;
    }
    case "create-resident": {
      const response = simulation.createResident(command.profile);
      if (response.ok) post({ type: "residents-changed", residents: simulation.getResidentStatics() });
      result(command.type, response, response.resident?.id, command.requestId);
      publishMutation(response);
      break;
    }
    case "lift": {
      const response = simulation.lift(command.residentId);
      result(command.type, response, command.residentId);
      publishMutation(response);
      break;
    }
    case "move-lifted":
      simulation.moveLifted(command.residentId, command.target, command.altitude);
      break;
    case "rotate-lifted":
      simulation.rotateLifted(command.residentId, command.radians);
      break;
    case "drop": {
      const response = simulation.drop(command.residentId, command.target, command.reducedMotion);
      if (!response.ok) result(command.type, response, command.residentId);
      publishMutation(response);
      break;
    }
    case "reinsert": {
      const response = simulation.reinsert(command.residentId, command.target);
      result(command.type, response, command.residentId);
      publishMutation(response);
      break;
    }
    case "cut-at": {
      const response = simulation.cutAt(command.target);
      result(command.type, response);
      if (response.ok) post({ type: "world-changed", world: simulation.world });
      publishMutation(response);
      break;
    }
    case "seal-at": {
      const response = simulation.sealAt(command.target);
      result(command.type, response);
      if (response.ok) post({ type: "world-changed", world: simulation.world });
      publishMutation(response);
      break;
    }
    case "reset-plane": {
      const response = simulation.resetPlane();
      result(command.type, response);
      post({ type: "world-changed", world: simulation.world });
      publishMutation(response);
      break;
    }
    case "undo-intervention": {
      const response = simulation.undoIntervention();
      result(command.type, response);
      if (response.ok) {
        post({ type: "world-changed", world: simulation.world });
      }
      publishMutation(response);
      break;
    }
    case "set-clock":
      simulation.setClock(command.paused, command.timeScale);
      snapshot();
      break;
    case "request-save":
      post({ type: "save-result", requestId: command.requestId, save: simulation.save() });
      break;
    case "load-save":
      simulation.load(command.save);
      ready();
      snapshot();
      break;
  }
};

setInterval(() => {
  if (!initialized) return;
  simulation.step();
  const completedDrops = simulation.takeCompletedDrops();
  if (completedDrops.length) snapshot();
  events();
  completedDrops.forEach((completion) => {
    result("drop", { ok: true, message: completion.message }, completion.residentId);
  });
}, STEP_INTERVAL_MS);

setInterval(() => {
  if (initialized) snapshot();
}, SNAPSHOT_INTERVAL_MS);
