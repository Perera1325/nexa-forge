import { describe, expect, it } from 'vitest';
import { BLOCKS } from '../blocks';
import { createEngine } from '../engine';
import { buildPlan } from '../engine/plan';
import { generateProject } from '../lib/generator';
import { loadProject, saveProject, type StoreLike } from '../lib/storage';
import { buildWorkflow, parseWorkflow, validateConfig, validateWorkflow } from '../lib/workflow';
import { EXAMPLES, getExample } from './index';

const memoryStore = (): StoreLike => {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
};

describe('example gallery', () => {
  it('contains the three scenarios plus the basic chain, with unique ids', () => {
    expect(EXAMPLES.map((e) => e.id)).toEqual(['smart-temperature', 'energy-monitoring', 'edge-to-cloud', 'getting-started']);
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
    expect(getExample('edge-to-cloud')?.title).toBe('Edge-to-Cloud Data Pipeline');
    expect(getExample('nope')).toBeUndefined();
  });

  it('builds a fresh copy every time, so loading one cannot change another load', () => {
    const a = EXAMPLES[0].build();
    a.nodes[0].data.config.min = 999;
    expect(EXAMPLES[0].build().nodes[0].data.config.min).not.toBe(999);
  });

  describe.each(EXAMPLES.map((e) => [e.id, e] as const))('%s', (_id, example) => {
    const { nodes, edges } = example.build();

    it('uses only supported block types, with unique ids and meaningful labels', () => {
      expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
      for (const n of nodes) {
        expect(Object.keys(BLOCKS)).toContain(n.data.kind);
        expect(n.data.label.trim().length).toBeGreaterThan(0);
      }
      expect(new Set(nodes.map((n) => n.data.label)).size).toBe(nodes.length);
      expect(nodes.some((n) => n.data.kind === 'sensor')).toBe(true);
    });

    it('has valid settings on every block', () => {
      for (const n of nodes) expect(validateConfig(n.data.kind, n.data.config), n.data.label).toEqual({});
    });

    it('has valid connections that pass workflow validation without issues', () => {
      const ids = new Set(nodes.map((n) => n.id));
      for (const e of edges) {
        expect(ids.has(e.source) && ids.has(e.target), e.id).toBe(true);
        expect(BLOCKS[nodes.find((n) => n.id === e.source)!.data.kind].hasOutput).toBe(true);
        expect(BLOCKS[nodes.find((n) => n.id === e.target)!.data.kind].hasInput).toBe(true);
      }
      expect(validateWorkflow(nodes, edges)).toEqual([]);
    });

    it('is planned by the engine with every block runnable and no issues', () => {
      const plan = buildPlan({ nodes, edges });
      expect(plan.issues).toEqual([]);
      expect(plan.order).toHaveLength(nodes.length);
      expect(plan.skipped).toEqual({});
    });

    it('is compatible with the workflow file format: export then import loses nothing', () => {
      const parsed = parseWorkflow(JSON.stringify(buildWorkflow(example.name, nodes, edges)));
      if (!parsed.ok) throw new Error(parsed.error);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.name).toBe(example.name);
      expect(parsed.nodes.map((n) => ({ id: n.id, data: n.data, position: n.position }))).toEqual(nodes.map((n) => ({ id: n.id, data: n.data, position: n.position })));
      expect(parsed.edges.map((e) => [e.source, e.target])).toEqual(edges.map((e) => [e.source, e.target]));
    });

    it('survives save and restore', () => {
      const store = memoryStore();
      expect(saveProject(example.name, nodes, edges, store).ok).toBe(true);
      const restored = loadProject(store);
      if (restored.status !== 'ok') throw new Error(restored.status);
      expect(restored.name).toBe(example.name);
      expect(restored.nodes).toHaveLength(nodes.length);
      expect(restored.edges).toHaveLength(edges.length);
    });

    it('simulates without any problem, with readings inside the sensor range and simulated-only events', () => {
      const engine = createEngine();
      const graph = { nodes, edges };
      const events = [...engine.start(graph).events];
      for (let i = 0; i < 40; i++) events.push(...engine.tick(graph).events);
      expect(events.filter((e) => e.kind === 'issue')).toEqual([]);
      const sensor = nodes.find((n) => n.data.kind === 'sensor')!;
      const readings = events.filter((e) => e.kind === 'sensor.reading').map((e) => Number(e.data?.value));
      expect(readings).toHaveLength(40);
      for (const v of readings) {
        expect(v).toBeGreaterThanOrEqual(Number(sensor.data.config.min));
        expect(v).toBeLessThanOrEqual(Number(sensor.data.config.max));
      }
      const external = events.filter((e) => ['mqtt.publish', 'api.request', 'docker.prepare', 'kubernetes.prepare'].includes(e.kind));
      expect(external.length).toBeGreaterThan(0);
      expect(external.every((e) => e.data?.simulated === true)).toBe(true);
    });

    it('generates a project whose config is valid JSON and whose README is honest', () => {
      const files = Object.fromEntries(generateProject(example.name, nodes, edges).map((f) => [f.path, f.content]));
      const config = JSON.parse(files['simulator/config.json']);
      expect(config.sensors.length).toBe(nodes.filter((n) => n.data.kind === 'sensor').length);
      expect(config.routes.length).toBeGreaterThan(0);
      expect(files['README.md']).toContain(`# ${example.name}`);
      expect(files['README.md']).toMatch(/Simulated\./);
    });
  });

  it('makes the Logic rules filter: some readings pass and some do not', () => {
    for (const id of ['smart-temperature', 'energy-monitoring', 'edge-to-cloud']) {
      const graph = getExample(id)!.build();
      const engine = createEngine();
      let met = 0;
      let notMet = 0;
      for (let i = 0; i < 40; i++) {
        for (const e of engine.tick(graph).events) {
          if (e.kind !== 'logic.evaluated') continue;
          if (e.data?.passed) met++;
          else notMet++;
        }
      }
      expect(met, `${id} passes sometimes`).toBeGreaterThan(0);
      expect(notMet, `${id} blocks sometimes`).toBeGreaterThan(0);
    }
  });

  it('energy example: every reading reaches the API, only high readings reach MQTT', () => {
    const graph = getExample('energy-monitoring')!.build();
    const engine = createEngine();
    let api = 0;
    let mqtt = 0;
    for (let i = 0; i < 40; i++) {
      const out = engine.tick(graph);
      api += out.events.filter((e) => e.kind === 'api.request').length;
      mqtt += out.events.filter((e) => e.kind === 'mqtt.publish').length;
    }
    expect(api).toBe(40);
    expect(mqtt).toBeGreaterThan(0);
    expect(mqtt).toBeLessThan(40);
  });
});
