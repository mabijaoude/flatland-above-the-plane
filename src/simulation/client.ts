import type { SimCommand, WorkerMessage, WorldSaveV3 } from "../types";

type Listener = (message: WorkerMessage) => void;
type LifecycleListener = (lifecycle: SimulationLifecycle) => void;

export type SimulationFailureReason = "startup-timeout" | "worker-error" | "message-error";

export type SimulationLifecycle =
  | { status: "starting"; attempt: number }
  | { status: "ready"; attempt: number }
  | { status: "error"; attempt: number; reason: SimulationFailureReason; message: string };

export type SimulationClientOptions = {
  workerFactory?: () => Worker;
  startupTimeoutMs?: number;
  seed?: number;
};

const DEFAULT_STARTUP_TIMEOUT_MS = 8000;

export class SimulationClient {
  private worker: Worker | undefined;
  private readonly workerFactory: () => Worker;
  private readonly startupTimeoutMs: number;
  private readonly seed: number;
  private listeners = new Set<Listener>();
  private lifecycleListeners = new Set<LifecycleListener>();
  private saveRequests = new Map<number, { resolve: (save: WorldSaveV3) => void; reject: (error: Error) => void; timeout: number }>();
  private requestId = 1;
  private attempt = 0;
  private startupTimeout: number | undefined;
  private lifecycle: SimulationLifecycle = { status: "starting", attempt: 0 };
  private disposed = false;

  constructor(options: SimulationClientOptions = {}) {
    this.workerFactory = options.workerFactory ?? (() => new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" }));
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
    this.seed = options.seed ?? 1884;
    this.startWorker();
  }

  private startWorker() {
    const attempt = ++this.attempt;
    this.setLifecycle({ status: "starting", attempt });

    let worker: Worker;
    try {
      worker = this.workerFactory();
    } catch (error) {
      this.setLifecycle({
        status: "error",
        attempt,
        reason: "worker-error",
        message: error instanceof Error ? error.message : "The town could not start its simulation worker."
      });
      return;
    }

    this.worker = worker;
    worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (this.worker !== worker) return;
      if (data.type === "ready") {
        this.clearStartupTimeout();
        this.setLifecycle({ status: "ready", attempt });
      }
      if (data.type === "save-result") {
        const request = this.saveRequests.get(data.requestId);
        if (request) {
          globalThis.clearTimeout(request.timeout);
          request.resolve(data.save);
          this.saveRequests.delete(data.requestId);
        }
      }
      this.listeners.forEach((listener) => listener(data));
    };
    worker.onerror = (event) => {
      if (this.worker !== worker) return;
      this.fail(worker, "worker-error", event.message || "The town's simulation worker stopped unexpectedly.");
    };
    worker.onmessageerror = () => {
      if (this.worker !== worker) return;
      this.fail(worker, "message-error", "The town sent a simulation response that this browser could not read.");
    };
    this.startupTimeout = globalThis.setTimeout(() => {
      if (this.worker !== worker || this.lifecycle.status !== "starting") return;
      this.fail(worker, "startup-timeout", `The town did not finish starting within ${Math.round(this.startupTimeoutMs / 1000)} seconds.`);
    }, this.startupTimeoutMs);
    try {
      worker.postMessage({ type: "initialize", seed: this.seed } satisfies SimCommand);
    } catch (error) {
      this.fail(
        worker,
        "worker-error",
        error instanceof Error ? error.message : "The town could not initialize its simulation worker."
      );
    }
  }

  private fail(worker: Worker, reason: SimulationFailureReason, message: string) {
    const attempt = this.attempt;
    this.clearStartupTimeout();
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    if (this.worker === worker) this.worker = undefined;
    this.rejectSaveRequests(new Error(message));
    this.setLifecycle({ status: "error", attempt, reason, message });
  }

  private clearStartupTimeout() {
    if (this.startupTimeout === undefined) return;
    globalThis.clearTimeout(this.startupTimeout);
    this.startupTimeout = undefined;
  }

  private rejectSaveRequests(error: Error) {
    this.saveRequests.forEach((request) => {
      globalThis.clearTimeout(request.timeout);
      request.reject(error);
    });
    this.saveRequests.clear();
  }

  private setLifecycle(lifecycle: SimulationLifecycle) {
    this.lifecycle = lifecycle;
    this.lifecycleListeners.forEach((listener) => listener(lifecycle));
  }

  send(command: SimCommand) {
    if (!this.worker) throw new Error("The simulation is not available. Restart it before sending another command.");
    this.worker.postMessage(command);
  }

  nextRequestId() {
    return this.requestId++;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLifecycle() {
    return this.lifecycle;
  }

  subscribeLifecycle(listener: LifecycleListener) {
    this.lifecycleListeners.add(listener);
    listener(this.lifecycle);
    return () => this.lifecycleListeners.delete(listener);
  }

  restart() {
    if (this.disposed) throw new Error("A closed simulation client cannot be restarted.");
    this.clearStartupTimeout();
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
      this.worker = undefined;
    }
    this.rejectSaveRequests(new Error("The simulation was restarted before answering the save request."));
    this.startWorker();
  }

  requestSave(): Promise<WorldSaveV3> {
    const requestId = this.nextRequestId();
    return new Promise((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        this.saveRequests.delete(requestId);
        reject(new Error("The town did not answer the save request in time."));
      }, 5000);
      this.saveRequests.set(requestId, { resolve, reject, timeout });
      try {
        this.send({ type: "request-save", requestId });
      } catch (error) {
        globalThis.clearTimeout(timeout);
        this.saveRequests.delete(requestId);
        reject(error);
      }
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearStartupTimeout();
    this.rejectSaveRequests(new Error("The simulation was closed."));
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
      this.worker = undefined;
    }
    this.listeners.clear();
    this.lifecycleListeners.clear();
  }
}
