import type { NexaNode, NodeRuntime } from '../types';
import { createSimulatedAdapters, type Adapters } from './adapters';
import { compare } from './logic';
import { buildPlan, issueKey, type ExecutionPlan } from './plan';
import type {
  ExecutionError,
  ExecutionEvent,
  NodeState,
  Signal,
  StartOutput,
  StopOutput,
  TickOutput,
  WorkflowGraph,
} from './types';

export interface EngineOptions {
  /** Where blocks reach the outside world. Defaults to the simulated adapters. */
  adapters?: Adapters;
  /** Source of randomness for mock data (inject a seeded one in tests). Ignored when `adapters` is given. */
  random?: () => number;
  /** Tick number to continue from (the first tick is startTick + 1). */
  startTick?: number;
}

/**
 * Executes a workflow step by step. Holds run state but no timers and no UI: a caller (see runner.ts) decides when to step.
 * The graph is passed on every call, so edits made while running take effect on the next step.
 */
export interface ExecutionEngine {
  /** Begins a run: reports the workflow's problems and prepares Docker / Kubernetes blocks (configuration only). */
  start(graph: WorkflowGraph): StartOutput;
  /** Runs one step: every sensor emits a reading that flows through the blocks in a valid order. */
  tick(graph: WorkflowGraph): TickOutput;
  stop(): StopOutput;
  /** Restarts tick counting and forgets block state. */
  reset(): void;
  readonly tickCount: number;
  snapshot(): Record<string, NodeState>;
}

const toRecord = (states: Map<string, NodeState>): Record<string, NodeState> =>
  Object.fromEntries([...states].map(([id, state]) => [id, { ...state }]));

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function createEngine(options: EngineOptions = {}): ExecutionEngine {
  const adapters = options.adapters ?? createSimulatedAdapters(options.random);
  let tickCount = options.startTick ?? 0;
  let states = new Map<string, NodeState>();
  let reported = new Set<string>();
  let planned: { graph: WorkflowGraph; plan: ExecutionPlan } | null = null;

  const planFor = (graph: WorkflowGraph): ExecutionPlan => {
    if (planned && planned.graph.nodes === graph.nodes && planned.graph.edges === graph.edges) return planned.plan;
    const plan = buildPlan(graph);
    planned = { graph, plan };
    return plan;
  };

  const event = (partial: Omit<ExecutionEvent, 'tick'>): ExecutionEvent => ({ ...partial, tick: tickCount });

  /** Reports each distinct problem once per run, not once per step. */
  const report = (issues: ExecutionError[], nodes: Map<string, NexaNode>, events: ExecutionEvent[]) => {
    for (const issue of issues) {
      const key = issueKey(issue);
      if (reported.has(key)) continue;
      reported.add(key);
      const node = issue.nodeId ? nodes.get(issue.nodeId) : undefined;
      events.push(
        event({
          kind: 'issue',
          level: issue.level === 'error' ? 'error' : 'warn',
          source: node?.data.label ?? 'Workflow',
          message: issue.message,
          nodeId: issue.nodeId,
          data: { code: issue.code },
        }),
      );
    }
  };

  const setState = (id: string, patch: Partial<NodeState> & Pick<NodeState, 'status'>) => {
    const prev = states.get(id);
    states.set(id, { runs: prev?.runs ?? 0, ...patch });
  };

  /** Block statuses for blocks that cannot run or have invalid settings. */
  const markUnrunnable = (plan: ExecutionPlan, graph: WorkflowGraph) => {
    for (const node of graph.nodes) {
      if (node.id in plan.skipped) setState(node.id, { status: 'skipped', reason: plan.skipped[node.id] });
    }
  };

  const start = (graph: WorkflowGraph): StartOutput => {
    states = new Map();
    reported = new Set();
    const plan = planFor(graph);
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const events: ExecutionEvent[] = [
      event({ kind: 'run.started', level: 'info', source: 'Simulation', message: 'Started' }),
      event({
        kind: 'run.notice',
        level: 'info',
        source: 'Simulation',
        message: 'Simulation mode: no MQTT broker, cloud API, container or cluster is contacted.',
      }),
    ];
    for (const node of graph.nodes) setState(node.id, { status: 'idle' });
    markUnrunnable(plan, graph);
    report(plan.issues, byId, events);
    for (const id of plan.order) {
      const node = byId.get(id);
      if (!node || id in plan.invalid) continue;
      const { kind, label, config } = node.data;
      if (kind !== 'docker' && kind !== 'kubernetes') continue;
      try {
        const record = adapters[kind].prepare(config);
        events.push(
          event({
            kind: kind === 'docker' ? 'docker.prepare' : 'kubernetes.prepare',
            level: 'info',
            source: label,
            nodeId: id,
            message: `${record.summary}${record.simulated ? ' · simulated, configuration only' : ''}`,
            data: { simulated: record.simulated },
          }),
        );
      } catch (err) {
        setState(id, { status: 'failed', reason: messageOf(err) });
        report([{ code: 'node-failed', level: 'error', message: `${label} failed to prepare: ${messageOf(err)}`, nodeId: id }], byId, events);
      }
    }
    return { events, nodes: toRecord(states) };
  };

  const tick = (graph: WorkflowGraph): TickOutput => {
    tickCount += 1;
    const plan = planFor(graph);
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const events: ExecutionEvent[] = [];
    const readings: Record<string, number> = {};
    const runtime: Record<string, NodeRuntime> = {};
    const outputs = new Map<string, Signal[]>();

    report(plan.issues, byId, events);
    markUnrunnable(plan, graph);

    for (const id of plan.order) {
      const node = byId.get(id);
      if (!node) continue;
      const { kind, label, config } = node.data;
      const prev = states.get(id);
      const bump = (patch: Partial<NodeState> & Pick<NodeState, 'status'>) => setState(id, { ...patch, runs: (prev?.runs ?? 0) + 1 });

      // Blocks with invalid settings never run; they are reported once and block what is downstream.
      if (id in plan.invalid) {
        setState(id, { status: 'failed', reason: plan.invalid[id] });
        outputs.set(id, []);
        continue;
      }

      // A block receives each sensor's reading at most once per step, even if it is reachable along several paths.
      const received: Signal[] = [];
      for (const source of plan.inputs[id] ?? []) {
        for (const signal of outputs.get(source) ?? []) {
          if (!received.some((r) => r.sensorId === signal.sensorId)) received.push(signal);
        }
      }

      try {
        if (kind === 'sensor') {
          const value = adapters.sensor.read(config, tickCount);
          if (!Number.isFinite(value)) throw new Error('the sensor produced an invalid reading');
          readings[id] = value;
          runtime[id] = { active: true, value };
          bump({ status: 'ok', value, reason: undefined });
          events.push(
            event({
              kind: 'sensor.reading',
              level: 'debug',
              source: label,
              nodeId: id,
              message: `${value} ${String(config.unit)}`,
              data: { value, simulated: true },
            }),
          );
          outputs.set(id, [{ sensorId: id, value, unit: String(config.unit) }]);
          continue;
        }

        if (received.length === 0) {
          setState(id, { status: 'idle', reason: undefined });
          outputs.set(id, []);
          continue;
        }
        const last = received[received.length - 1];

        if (kind === 'logic') {
          const passing: Signal[] = [];
          for (const signal of received) {
            const operator = String(config.operator);
            const threshold = Number(config.threshold);
            const passed = compare(signal.value, operator, threshold);
            events.push(
              event({
                kind: 'logic.evaluated',
                level: passed ? 'warn' : 'debug',
                source: label,
                nodeId: id,
                message: passed
                  ? `Condition met: ${signal.value} ${signal.unit} ${operator} ${threshold}`
                  : `Condition not met: ${signal.value} ${signal.unit} ${operator} ${threshold}`,
                data: { value: signal.value, operator, threshold, passed },
              }),
            );
            if (passed) passing.push(signal);
          }
          const passed = passing.length > 0;
          runtime[id] = { active: true, value: last.value, passed };
          bump({ status: passed ? 'ok' : 'blocked', value: last.value, passed, reason: undefined });
          outputs.set(id, passing);
          continue;
        }

        runtime[id] = { active: true, value: last.value };
        if (kind === 'mqtt') {
          for (const signal of received) {
            const record = adapters.mqtt.publish(config, signal);
            events.push(
              event({
                kind: 'mqtt.publish',
                level: 'event',
                source: label,
                nodeId: id,
                message: `PUBLISH ${record.topic} ${record.payload}${record.simulated ? ' · simulated' : ''}`,
                data: { topic: record.topic, payload: record.payload, qos: record.qos, broker: record.broker, simulated: record.simulated },
              }),
            );
          }
          bump({ status: 'ok', value: last.value, reason: undefined });
        } else if (kind === 'cloudApi') {
          for (const signal of received) {
            const record = adapters.api.request(config, signal);
            events.push(
              event({
                kind: 'api.request',
                level: 'event',
                source: label,
                nodeId: id,
                message: `${record.method} ${record.url}${record.simulated ? ' · simulated' : ''}`,
                data: { method: record.method, url: record.url, body: record.body, simulated: record.simulated },
              }),
            );
          }
          bump({ status: 'ok', value: last.value, reason: undefined });
        } else {
          // Docker / Kubernetes: configuration was prepared at start; data passing through triggers nothing else.
          bump({ status: 'prepared', value: last.value, reason: undefined });
        }
        outputs.set(id, received);
      } catch (err) {
        delete runtime[id];
        setState(id, { status: 'failed', reason: messageOf(err) });
        outputs.set(id, []);
        report([{ code: 'node-failed', level: 'error', message: `${label} failed: ${messageOf(err)}`, nodeId: id }], byId, events);
      }
    }
    return { tick: tickCount, events, readings, nodes: toRecord(states), runtime };
  };

  return {
    start,
    tick,
    stop: () => ({
      events: [event({ kind: 'run.stopped', level: 'info', source: 'Simulation', message: 'Stopped' })],
      nodes: toRecord(states),
    }),
    reset: () => {
      tickCount = 0;
      states = new Map();
      reported = new Set();
      planned = null;
    },
    get tickCount() {
      return tickCount;
    },
    snapshot: () => toRecord(states),
  };
}
