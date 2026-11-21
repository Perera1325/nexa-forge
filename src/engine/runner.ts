import { createEngine, type ExecutionEngine } from './engine';
import type { StartOutput, StopOutput, TickOutput, WorkflowGraph } from './types';

/** The timer functions the runner uses. Injectable so tests need no real time. */
export interface Scheduler {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const defaultScheduler: Scheduler = {
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>),
};

export interface RunnerOptions {
  /** Returns the current workflow. Called on every step, so live edits take effect. */
  getGraph(): WorkflowGraph;
  onStart(output: StartOutput): void;
  onTick(output: TickOutput): void;
  onStop(output: StopOutput): void;
  /** Called if the engine itself throws. The run is stopped first. */
  onError(error: Error): void;
  intervalMs?: number;
  scheduler?: Scheduler;
  engine?: ExecutionEngine;
}

export interface Runner {
  /** Starts a run. Returns false (and does nothing) if one is already running, so a second timer can never exist. */
  start(): boolean;
  /** Stops the run and clears the timer. Returns false if nothing was running. */
  stop(): boolean;
  /** Clears the timer without any callbacks. Use when the owner goes away (for example a component unmounting). */
  dispose(): void;
  /** Restarts tick counting and clears block state. Safe while running. */
  reset(): void;
  isRunning(): boolean;
}

/** Drives an execution engine on a timer: exactly one timer while running, none otherwise. */
export function createRunner(options: RunnerOptions): Runner {
  const engine = options.engine ?? createEngine();
  const scheduler = options.scheduler ?? defaultScheduler;
  const intervalMs = options.intervalMs ?? 1000;
  let handle: unknown;
  let running = false;

  const clear = () => {
    if (handle !== undefined) scheduler.clearInterval(handle);
    handle = undefined;
    running = false;
  };

  const step = () => {
    if (!running) return;
    try {
      options.onTick(engine.tick(options.getGraph()));
    } catch (err) {
      clear();
      options.onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return {
    start() {
      if (running) return false;
      running = true;
      try {
        options.onStart(engine.start(options.getGraph()));
        step();
        if (running) handle = scheduler.setInterval(step, intervalMs);
      } catch (err) {
        clear();
        options.onError(err instanceof Error ? err : new Error(String(err)));
        return false;
      }
      return running;
    },
    stop() {
      if (!running) return false;
      clear();
      options.onStop(engine.stop());
      return true;
    },
    dispose: clear,
    reset: () => engine.reset(),
    isRunning: () => running,
  };
}
