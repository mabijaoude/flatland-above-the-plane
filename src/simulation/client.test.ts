import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerMessage } from "../types";
import { SimulationClient } from "./client";

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  emit(message: WorkerMessage) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerMessage>);
  }

  fail(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SimulationClient lifecycle", () => {
  it("initializes every worker and becomes ready when the town answers", () => {
    const workers: FakeWorker[] = [];
    const client = new SimulationClient({
      seed: 42,
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      }
    });

    expect(workers[0].postMessage).toHaveBeenCalledWith({ type: "initialize", seed: 42 });
    expect(client.getLifecycle()).toEqual({ status: "starting", attempt: 1 });

    workers[0].emit({ type: "ready", world: {} as never, residents: [], events: [] });
    expect(client.getLifecycle()).toEqual({ status: "ready", attempt: 1 });

    client.restart();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(workers[1].postMessage).toHaveBeenCalledWith({ type: "initialize", seed: 42 });
    expect(client.getLifecycle()).toEqual({ status: "starting", attempt: 2 });
    client.dispose();
  });

  it("surfaces worker errors and can recover with a fresh worker", () => {
    const workers: FakeWorker[] = [];
    const client = new SimulationClient({
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      }
    });

    workers[0].fail("worker crashed");
    expect(client.getLifecycle()).toMatchObject({
      status: "error",
      attempt: 1,
      reason: "worker-error",
      message: "worker crashed"
    });
    expect(workers[0].terminate).toHaveBeenCalledOnce();

    client.restart();
    expect(client.getLifecycle()).toEqual({ status: "starting", attempt: 2 });
    expect(workers[1].postMessage).toHaveBeenCalledWith({ type: "initialize", seed: 1884 });
    client.dispose();
  });

  it("turns a silent startup into a retryable timeout", () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const client = new SimulationClient({
      startupTimeoutMs: 25,
      workerFactory: () => worker as unknown as Worker
    });

    vi.advanceTimersByTime(26);
    expect(client.getLifecycle()).toMatchObject({
      status: "error",
      reason: "startup-timeout"
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
    client.dispose();
  });
});
