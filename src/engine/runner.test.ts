import { describe, expect, it } from 'vitest';
import { createDemoWorkflow } from '../lib/nodes';
import { createEngine } from './engine';
import { createRunner, type Scheduler } from './runner';
import type { StartOutput, StopOutput, TickOutput, WorkflowGraph } from './types';

/** A scheduler driven by hand: counts live timers and fires them on demand. */
function fakeScheduler() {
  const timers = new Map<number, () => void>();
  let next = 1;
  const scheduler: Scheduler = {
    setInterval: (callback) => {
      timers.set(next, callback);
      return next++;
    },
    clearInterval: (handle) => {
      timers.delete(handle as number);
    },
  };
  return { scheduler, live: () => timers.size, fire: () => [...timers.values()].forEach((cb) => cb()) };
}

/** The example workflow with a sensor that always reads (almost exactly) 50, so the Logic block (> 70) is predictable. */
function example(): WorkflowGraph {
  const { nodes, edges } = createDemoWorkflow();
  nodes[0].data.config = { ...nodes[0].data.config, min: 50, max: 50.0001, pattern: 'random' };
  nodes[1].data.config = { operator: '>', threshold: 10 };
  return { nodes, edges };
}

function setup(graph: WorkflowGraph = example()) {
  const fake = fakeScheduler();
  const log: string[] = [];
  const ticks: TickOutput[] = [];
  const errors: Error[] = [];
  let current = graph;
  const runner = createRunner({
    getGraph: () => current,
    scheduler: fake.scheduler,
    engine: createEngine({ random: () => 0.5 }),
    onStart: (o: StartOutput) => log.push(`start:${o.events.length}`),
    onTick: (o) => {
      ticks.push(o);
      log.push(`tick:${o.tick}`);
    },
    onStop: (o: StopOutput) => log.push(`stop:${o.events.length}`),
    onError: (e) => errors.push(e),
  });
  return { runner, fake, log, ticks, errors, setGraph: (g: WorkflowGraph) => (current = g) };
}

describe('createRunner', () => {
  it('starts with one immediate step and then steps on the timer', () => {
    const { runner, fake, ticks } = setup();
    expect(runner.start()).toBe(true);
    expect(runner.isRunning()).toBe(true);
    expect(ticks).toHaveLength(1);
    fake.fire();
    fake.fire();
    expect(ticks.map((t) => t.tick)).toEqual([1, 2, 3]);
  });

  it('never creates a second timer when started twice', () => {
    const { runner, fake, log } = setup();
    expect(runner.start()).toBe(true);
    expect(runner.start()).toBe(false);
    expect(fake.live()).toBe(1);
    expect(log.filter((l) => l.startsWith('start')).length).toBe(1);
  });

  it('clears its timer on stop and ignores further stops', () => {
    const { runner, fake, ticks, log } = setup();
    runner.start();
    expect(runner.stop()).toBe(true);
    expect(fake.live()).toBe(0);
    expect(runner.isRunning()).toBe(false);
    expect(runner.stop()).toBe(false);
    fake.fire();
    expect(ticks).toHaveLength(1);
    expect(log.filter((l) => l.startsWith('stop'))).toHaveLength(1);
  });

  it('can be started again after a stop and keeps one timer', () => {
    const { runner, fake, ticks } = setup();
    runner.start();
    runner.stop();
    expect(runner.start()).toBe(true);
    expect(fake.live()).toBe(1);
    expect(ticks.map((t) => t.tick)).toEqual([1, 2]);
  });

  it('dispose clears the timer without calling back', () => {
    const { runner, fake, log } = setup();
    runner.start();
    runner.dispose();
    expect(fake.live()).toBe(0);
    expect(runner.isRunning()).toBe(false);
    expect(log.some((l) => l.startsWith('stop'))).toBe(false);
  });

  it('reads the latest graph on every step', () => {
    const { runner, fake, ticks, setGraph } = setup();
    runner.start();
    expect(Object.keys(ticks[0].runtime)).toHaveLength(6);
    setGraph({ nodes: [], edges: [] });
    fake.fire();
    expect(Object.keys(ticks[1].runtime)).toHaveLength(0);
  });

  it('reset restarts tick counting even while running', () => {
    const { runner, fake, ticks } = setup();
    runner.start();
    fake.fire();
    runner.reset();
    fake.fire();
    expect(ticks.map((t) => t.tick)).toEqual([1, 2, 1]);
    expect(fake.live()).toBe(1);
  });

  it('stops itself and reports if the engine throws', () => {
    const fake = fakeScheduler();
    const errors: Error[] = [];
    let boom = false;
    const runner = createRunner({
      getGraph: () => {
        if (boom) throw new Error('graph unavailable');
        return createDemoWorkflow();
      },
      scheduler: fake.scheduler,
      onStart: () => undefined,
      onTick: () => undefined,
      onStop: () => undefined,
      onError: (e) => errors.push(e),
    });
    runner.start();
    boom = true;
    fake.fire();
    expect(errors.map((e) => e.message)).toEqual(['graph unavailable']);
    expect(runner.isRunning()).toBe(false);
    expect(fake.live()).toBe(0);
    boom = false;
    expect(runner.start()).toBe(true);
    expect(fake.live()).toBe(1);
  });

  it('reports a failure on the very first step and leaves no timer behind', () => {
    const fake = fakeScheduler();
    const errors: Error[] = [];
    const runner = createRunner({
      getGraph: () => {
        throw new Error('nope');
      },
      scheduler: fake.scheduler,
      onStart: () => undefined,
      onTick: () => undefined,
      onStop: () => undefined,
      onError: (e) => errors.push(e),
    });
    expect(runner.start()).toBe(false);
    expect(errors).toHaveLength(1);
    expect(fake.live()).toBe(0);
    expect(runner.isRunning()).toBe(false);
  });
});
