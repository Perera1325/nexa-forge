import type { NexaEdge, NexaNode, NodeConfig, NodeRuntime } from '../types';

export interface TickMessage {
  level: 'info' | 'event' | 'warn';
  message: string;
}

export interface TickResult {
  runtime: Record<string, NodeRuntime>;
  readings: Record<string, number>;
  messages: TickMessage[];
}

/** Mock sensor data: sine wave with noise, uniform random, or a repeating ramp. */
export function generateReading(config: NodeConfig, tick: number): number {
  const min = Number(config.min);
  const max = Number(config.max);
  if (!(max > min)) return Number.isFinite(min) ? min : 0;
  const mid = (min + max) / 2;
  const amp = (max - min) / 2;
  let value: number;
  switch (config.pattern) {
    case 'random':
      value = min + Math.random() * (max - min);
      break;
    case 'ramp':
      value = min + ((tick * (max - min)) / 30) % (max - min);
      break;
    default:
      value = mid + amp * 0.8 * Math.sin(tick / 6) + (Math.random() - 0.5) * amp * 0.2;
  }
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

export function compare(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    case '==':
      return value === threshold;
    default:
      return false;
  }
}

interface Signal {
  value: number;
  unit: string;
}

/** Runs one simulation step: every sensor emits a reading that flows along the edges. */
export function runTick(nodes: NexaNode[], edges: NexaEdge[], tick: number): TickResult {
  const runtime: Record<string, NodeRuntime> = {};
  const readings: Record<string, number> = {};
  const messages: TickMessage[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const downstream = (id: string): NexaNode[] =>
    edges
      .filter((e) => e.source === id)
      .map((e) => byId.get(e.target))
      .filter((n): n is NexaNode => n !== undefined);

  const visit = (node: NexaNode, signal: Signal, path: Set<string>): void => {
    if (path.has(node.id)) return; // guard against cycles
    const nextPath = new Set(path).add(node.id);
    const { kind, label, config } = node.data;

    if (kind === 'logic') {
      const passed = compare(signal.value, String(config.operator), Number(config.threshold));
      runtime[node.id] = { active: true, value: signal.value, passed };
      if (!passed) return;
      messages.push({ level: 'warn', message: `${label}: ${signal.value}${signal.unit} ${config.operator} ${config.threshold} - triggered` });
    } else if (kind === 'mqtt') {
      runtime[node.id] = { active: true, value: signal.value };
      messages.push({ level: 'event', message: `${label}: PUBLISH ${config.topic} {"value":${signal.value}}` });
    } else if (kind === 'cloudApi') {
      runtime[node.id] = { active: true, value: signal.value };
      messages.push({ level: 'event', message: `${label}: ${config.method} ${config.url}` });
    } else {
      runtime[node.id] = { active: true, value: signal.value };
    }
    downstream(node.id).forEach((n) => visit(n, signal, nextPath));
  };

  for (const node of nodes) {
    if (node.data.kind !== 'sensor') continue;
    const value = generateReading(node.data.config, tick);
    readings[node.id] = value;
    runtime[node.id] = { active: true, value };
    const signal: Signal = { value, unit: String(node.data.config.unit) };
    downstream(node.id).forEach((n) => visit(n, signal, new Set([node.id])));
  }
  return { runtime, readings, messages };
}
