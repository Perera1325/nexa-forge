import { BLOCKS } from '../blocks';
import { validateConfig } from '../lib/workflow';
import type { ExecutionError, WorkflowGraph } from './types';

export interface ExecutionPlan {
  /** Blocks that can run, sources first (a topological order of the valid connections). */
  order: string[];
  /** For each runnable block, the blocks that feed it through valid connections. */
  inputs: Record<string, string[]>;
  /** Blocks that cannot run, with the reason. */
  skipped: Record<string, string>;
  /** Blocks with invalid settings. They are planned but fail when executed. */
  invalid: Record<string, string>;
  /** Everything wrong with the workflow: errors and warnings. */
  issues: ExecutionError[];
}

const isKnown = (kind: unknown): boolean => typeof kind === 'string' && Object.hasOwn(BLOCKS, kind);

/** A stable identity for an issue, used to report each problem once. */
export const issueKey = (issue: ExecutionError): string => `${issue.code}|${issue.nodeId ?? ''}|${issue.edgeId ?? ''}|${issue.message}`;

/**
 * Validates a workflow and works out in which order its blocks can run.
 * Never throws: every problem becomes an issue, and the blocks that can still run are planned.
 */
export function buildPlan(graph: WorkflowGraph): ExecutionPlan {
  const issues: ExecutionError[] = [];
  const skipped: Record<string, string> = {};
  const invalid: Record<string, string> = {};

  // --- blocks
  const nodes = new Map<string, (typeof graph.nodes)[number]>();
  for (const node of graph.nodes) {
    if (nodes.has(node.id)) continue; // first wins; duplicate ids are rejected at import time
    nodes.set(node.id, node);
    if (!isKnown(node.data.kind)) {
      const message = `${node.data.label || node.id} has an unknown block type "${String(node.data.kind)}".`;
      issues.push({ code: 'unknown-kind', level: 'error', message, nodeId: node.id });
      skipped[node.id] = message;
    }
  }
  const runnable = (id: string) => nodes.has(id) && !(id in skipped);
  const labelOf = (id: string) => nodes.get(id)?.data.label ?? id;

  // --- connections
  const edges: Array<{ id: string; source: string; target: string }> = [];
  const seenEdges = new Set<string>();
  for (const edge of graph.edges) {
    const warn = (code: 'invalid-edge' | 'duplicate-edge' | 'self-loop', message: string) =>
      issues.push({ code, level: 'warning', message, edgeId: edge.id });
    if (edge.source === edge.target) {
      warn('self-loop', `A connection from ${labelOf(edge.source)} to itself was ignored.`);
    } else if (!nodes.has(edge.source) || !nodes.has(edge.target)) {
      warn('invalid-edge', `A connection to a missing block was ignored (${edge.source} → ${edge.target}).`);
    } else if (!runnable(edge.source) || !runnable(edge.target)) {
      // one end has an unknown type; that block is already reported
    } else if (!BLOCKS[nodes.get(edge.source)!.data.kind].hasOutput) {
      warn('invalid-edge', `${labelOf(edge.source)} has no output, so its connection to ${labelOf(edge.target)} was ignored.`);
    } else if (!BLOCKS[nodes.get(edge.target)!.data.kind].hasInput) {
      warn('invalid-edge', `${labelOf(edge.target)} has no input, so the connection from ${labelOf(edge.source)} was ignored.`);
    } else if (seenEdges.has(`${edge.source}>${edge.target}`)) {
      warn('duplicate-edge', `A duplicate connection from ${labelOf(edge.source)} to ${labelOf(edge.target)} was ignored.`);
    } else {
      seenEdges.add(`${edge.source}>${edge.target}`);
      edges.push({ id: edge.id, source: edge.source, target: edge.target });
    }
  }

  // --- configuration
  for (const node of nodes.values()) {
    if (!runnable(node.id)) continue;
    const { kind, label, config } = node.data;
    const problems = Object.entries(validateConfig(kind, config)).map(([key, message]) => {
      const field = BLOCKS[kind].fields.find((f) => f.key === key)?.label ?? key;
      return `${label} · ${field}: ${message}`;
    });
    for (const message of problems) issues.push({ code: 'invalid-config', level: 'error', message, nodeId: node.id });
    if (problems.length > 0) invalid[node.id] = problems[0];
  }

  // --- reachability from sensors
  const sensors = [...nodes.values()].filter((n) => runnable(n.id) && n.data.kind === 'sensor').map((n) => n.id);
  if (nodes.size > 0 && sensors.length === 0) {
    issues.push({ code: 'no-sensor', level: 'warning', message: 'No data source. Add a Virtual Sensor to run the simulation.' });
  }
  const reached = new Set<string>(sensors);
  const queue = [...sensors];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const e of edges) {
      if (e.source === id && !reached.has(e.target)) {
        reached.add(e.target);
        queue.push(e.target);
      }
    }
  }
  for (const node of nodes.values()) {
    if (!runnable(node.id) || reached.has(node.id)) continue;
    const message = `${node.data.label} is not connected to a sensor and will not run.`;
    issues.push({ code: 'unreachable', level: 'warning', message, nodeId: node.id });
    skipped[node.id] = message;
  }
  for (const id of sensors) {
    if (!edges.some((e) => e.source === id)) {
      issues.push({ code: 'unreachable', level: 'warning', message: `${labelOf(id)} has no outgoing connection.`, nodeId: id });
    }
  }

  // --- order (Kahn's algorithm over the reachable blocks)
  const live = [...nodes.keys()].filter((id) => reached.has(id));
  const liveEdges = edges.filter((e) => reached.has(e.source) && reached.has(e.target));
  const indegree = new Map(live.map((id) => [id, 0]));
  for (const e of liveEdges) indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  const ready = live.filter((id) => indegree.get(id) === 0);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const e of liveEdges) {
      if (e.source !== id) continue;
      const left = (indegree.get(e.target) ?? 0) - 1;
      indegree.set(e.target, left);
      if (left === 0) ready.push(e.target);
    }
  }
  if (order.length < live.length) {
    const inOrder = new Set(order);
    const stuck = live.filter((id) => !inOrder.has(id));
    const names = stuck.map(labelOf).join(', ');
    issues.push({ code: 'cycle', level: 'error', message: `These blocks feed each other in a loop and will not run: ${names}.`, nodeId: stuck[0] });
    for (const id of stuck) skipped[id] = 'Part of a connection loop.';
  }

  const inputs: Record<string, string[]> = {};
  const inOrder = new Set(order);
  for (const id of order) inputs[id] = liveEdges.filter((e) => e.target === id && inOrder.has(e.source)).map((e) => e.source);
  return { order, inputs, skipped, invalid, issues };
}
