import { describe, expect, it } from 'vitest';
import { createDemoWorkflow, createNode } from '../lib/nodes';
import type { NexaEdge } from '../types';
import { buildPlan } from './plan';

const edge = (source: string, target: string): NexaEdge => ({ id: `${source}>${target}`, source, target });
const codes = (plan: ReturnType<typeof buildPlan>) => plan.issues.map((i) => i.code);

describe('buildPlan', () => {
  it('orders the example workflow from source to sink with no issues', () => {
    const plan = buildPlan(createDemoWorkflow());
    expect(plan.order).toEqual(['demo-sensor', 'demo-logic', 'demo-mqtt', 'demo-api', 'demo-docker', 'demo-k8s']);
    expect(plan.issues).toEqual([]);
    expect(plan.inputs['demo-logic']).toEqual(['demo-sensor']);
    expect(plan.inputs['demo-sensor']).toEqual([]);
  });

  it('runs every block after all of its inputs, regardless of the order blocks are stored in', () => {
    const { nodes, edges } = createDemoWorkflow();
    const plan = buildPlan({ nodes: [...nodes].reverse(), edges: [...edges].reverse() });
    const pos = (id: string) => plan.order.indexOf(id);
    for (const e of edges) expect(pos(e.source)).toBeLessThan(pos(e.target));
    expect(plan.order).toHaveLength(6);
  });

  it('handles a diamond: both branches run before the join', () => {
    const s = createNode('sensor', { x: 0, y: 0 }, 's');
    const a = createNode('logic', { x: 0, y: 0 }, 'a');
    const b = createNode('logic', { x: 0, y: 0 }, 'b');
    const m = createNode('mqtt', { x: 0, y: 0 }, 'm');
    const plan = buildPlan({ nodes: [m, b, a, s], edges: [edge('s', 'a'), edge('s', 'b'), edge('a', 'm'), edge('b', 'm')] });
    expect(plan.order[0]).toBe('s');
    expect(plan.order[3]).toBe('m');
    expect(plan.inputs.m.sort()).toEqual(['a', 'b']);
  });

  it('skips and warns about blocks that no sensor reaches', () => {
    const { nodes, edges } = createDemoWorkflow();
    const lonely = createNode('logic', { x: 0, y: 0 }, 'lonely');
    const plan = buildPlan({ nodes: [...nodes, lonely], edges });
    expect(plan.order).not.toContain('lonely');
    expect(plan.skipped.lonely).toMatch(/not connected to a sensor/);
    expect(plan.issues).toContainEqual(expect.objectContaining({ code: 'unreachable', level: 'warning', nodeId: 'lonely' }));
  });

  it('ignores invalid connections and reports them as warnings', () => {
    const { nodes, edges } = createDemoWorkflow();
    const bad: NexaEdge[] = [
      edge('demo-sensor', 'ghost'), // missing block
      edge('demo-logic', 'demo-logic'), // self loop
      edge('demo-k8s', 'demo-docker'), // Kubernetes has no output
      edge('demo-mqtt', 'demo-sensor'), // sensors have no input
      edge('demo-sensor', 'demo-logic'), // duplicate of an existing connection (different id below)
    ];
    bad[4] = { id: 'dup', source: 'demo-sensor', target: 'demo-logic' };
    const plan = buildPlan({ nodes, edges: [...edges, ...bad] });
    expect(codes(plan).sort()).toEqual(['duplicate-edge', 'invalid-edge', 'invalid-edge', 'invalid-edge', 'self-loop']);
    expect(plan.issues.every((i) => i.level === 'warning')).toBe(true);
    expect(plan.order).toEqual(['demo-sensor', 'demo-logic', 'demo-mqtt', 'demo-api', 'demo-docker', 'demo-k8s']);
  });

  it('detects a loop, reports an error and still plans the blocks outside it', () => {
    const s = createNode('sensor', { x: 0, y: 0 }, 's');
    const a = createNode('logic', { x: 0, y: 0 }, 'a');
    const b = createNode('mqtt', { x: 0, y: 0 }, 'b');
    const c = createNode('cloudApi', { x: 0, y: 0 }, 'c');
    const plan = buildPlan({ nodes: [s, a, b, c], edges: [edge('s', 'a'), edge('a', 'b'), edge('b', 'a'), edge('s', 'c')] });
    const cycle = plan.issues.find((i) => i.code === 'cycle');
    expect(cycle?.level).toBe('error');
    expect(plan.order).toEqual(['s', 'c']);
    expect(plan.skipped.a).toBeDefined();
    expect(plan.skipped.b).toBeDefined();
  });

  it('flags invalid settings per field but still plans the block', () => {
    const { nodes, edges } = createDemoWorkflow();
    nodes[1].data.config = { operator: '>', threshold: '' };
    const plan = buildPlan({ nodes, edges });
    expect(plan.invalid['demo-logic']).toMatch(/Overheat Rule · Threshold/);
    expect(plan.issues).toContainEqual(expect.objectContaining({ code: 'invalid-config', level: 'error', nodeId: 'demo-logic' }));
    expect(plan.order).toContain('demo-logic');
  });

  it('rejects blocks of an unknown type without crashing', () => {
    const { nodes, edges } = createDemoWorkflow();
    const odd = createNode('logic', { x: 0, y: 0 }, 'odd');
    (odd.data as { kind: string }).kind = 'toString';
    const plan = buildPlan({ nodes: [...nodes, odd], edges: [...edges, edge('demo-sensor', 'odd')] });
    expect(plan.skipped.odd).toMatch(/unknown block type/);
    expect(codes(plan)).toContain('unknown-kind');
  });

  it('warns when there is no sensor, and is empty for an empty workflow', () => {
    const only = createNode('mqtt', { x: 0, y: 0 }, 'm');
    expect(codes(buildPlan({ nodes: [only], edges: [] }))).toContain('no-sensor');
    expect(buildPlan({ nodes: [], edges: [] })).toEqual({ order: [], inputs: {}, skipped: {}, invalid: {}, issues: [] });
  });

  it('warns about a sensor with no outgoing connection', () => {
    const s = createNode('sensor', { x: 0, y: 0 }, 's');
    const plan = buildPlan({ nodes: [s], edges: [] });
    expect(plan.order).toEqual(['s']);
    expect(plan.issues).toContainEqual(expect.objectContaining({ code: 'unreachable', nodeId: 's' }));
  });
});
