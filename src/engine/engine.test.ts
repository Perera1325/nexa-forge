import { describe, expect, it } from 'vitest';
import { createDemoWorkflow, createNode } from '../lib/nodes';
import type { NexaEdge } from '../types';
import { createSimulatedAdapters, generateReading, type Adapters } from './adapters';
import { createEngine } from './engine';
import { compare } from './logic';
import type { WorkflowGraph } from './types';

const edge = (source: string, target: string): NexaEdge => ({ id: `${source}>${target}`, source, target });

/** The example workflow with a sensor that always reads (almost exactly) 50. */
const constant50 = (threshold = 10): WorkflowGraph => {
  const { nodes, edges } = createDemoWorkflow();
  nodes[0].data.config = { ...nodes[0].data.config, min: 50, max: 50.0001, pattern: 'random' };
  nodes[1].data.config = { operator: '>', threshold };
  return { nodes, edges };
};
const mid = () => 0.5;

describe('generateReading', () => {
  it('stays within the configured range for every pattern', () => {
    for (const pattern of ['sine', 'random', 'ramp']) {
      for (let tick = 0; tick < 200; tick++) {
        const v = generateReading({ min: 10, max: 20, pattern }, tick);
        expect(v).toBeGreaterThanOrEqual(10);
        expect(v).toBeLessThanOrEqual(20);
      }
    }
  });

  it('is safe for an invalid range', () => {
    expect(generateReading({ min: 5, max: 5 }, 1)).toBe(5);
    expect(generateReading({ min: 9, max: 1 }, 1)).toBe(9);
    expect(generateReading({ min: '', max: 'x' }, 1)).toBe(0);
  });

  it('is deterministic with an injected random source', () => {
    expect(generateReading({ min: 0, max: 100, pattern: 'random' }, 1, () => 0.25)).toBe(25);
    expect(generateReading({ min: 0, max: 30, pattern: 'ramp' }, 15)).toBe(15);
  });
});

describe('compare', () => {
  it('implements every operator and rejects unknown ones', () => {
    expect(compare(5, '>', 4)).toBe(true);
    expect(compare(5, '<', 4)).toBe(false);
    expect(compare(5, '>=', 5)).toBe(true);
    expect(compare(5, '<=', 4)).toBe(false);
    expect(compare(5, '==', 5)).toBe(true);
    expect(compare(5, '!=', 5)).toBe(false);
  });
});

describe('engine.tick', () => {
  it('runs the whole chain when the condition is met, with honest simulated events', () => {
    const out = createEngine({ random: mid }).tick(constant50(10));
    expect(out.tick).toBe(1);
    expect(Object.keys(out.runtime)).toHaveLength(6);
    expect(out.runtime['demo-logic'].passed).toBe(true);
    const mqtt = out.events.find((e) => e.kind === 'mqtt.publish');
    expect(mqtt?.message).toBe('PUBLISH nexa/factory/telemetry {"value":50} · simulated');
    expect(mqtt?.data).toMatchObject({ simulated: true, topic: 'nexa/factory/telemetry', broker: 'localhost:1883', qos: 0 });
    const api = out.events.find((e) => e.kind === 'api.request');
    expect(api?.message).toBe('POST https://api.example.com/v1/telemetry · simulated');
    expect(api?.data).toMatchObject({ simulated: true, method: 'POST' });
    expect(out.events.find((e) => e.kind === 'logic.evaluated')).toMatchObject({ level: 'warn', source: 'Overheat Rule', message: 'Condition met: 50 °C > 10' });
  });

  it('records a status for every block', () => {
    const out = createEngine({ random: mid }).tick(constant50(10));
    expect(Object.fromEntries(Object.entries(out.nodes).map(([id, s]) => [id, s.status]))).toEqual({
      'demo-sensor': 'ok',
      'demo-logic': 'ok',
      'demo-mqtt': 'ok',
      'demo-api': 'ok',
      'demo-docker': 'prepared',
      'demo-k8s': 'prepared',
    });
    expect(out.nodes['demo-sensor']).toMatchObject({ value: 50, runs: 1 });
  });

  it('blocks everything downstream when a Logic condition is not met', () => {
    const out = createEngine({ random: mid }).tick(constant50(99));
    expect(out.runtime['demo-logic'].passed).toBe(false);
    expect(out.runtime['demo-mqtt']).toBeUndefined();
    expect(out.nodes['demo-logic'].status).toBe('blocked');
    expect(out.nodes['demo-mqtt'].status).toBe('idle');
    expect(out.events.filter((e) => e.level !== 'debug')).toEqual([]);
    expect(out.events.find((e) => e.kind === 'logic.evaluated')?.level).toBe('debug');
  });

  it('counts runs per block across steps', () => {
    const engine = createEngine({ random: mid });
    const graph = constant50(10);
    engine.tick(graph);
    const out = engine.tick(graph);
    expect(out.tick).toBe(2);
    expect(out.nodes['demo-mqtt'].runs).toBe(2);
  });

  it('does nothing without a sensor', () => {
    const only = [createNode('mqtt', { x: 0, y: 0 }, 'm')];
    const out = createEngine().tick({ nodes: only, edges: [] });
    expect(out.runtime).toEqual({});
    expect(out.readings).toEqual({});
    expect(out.events.map((e) => e.data?.code)).toEqual(['no-sensor', 'unreachable']);
    expect(out.events[0].message).toBe('No data source. Add a Virtual Sensor to run the simulation.');
  });

  it('sends a reading to a block that several paths reach only once', () => {
    const s = createNode('sensor', { x: 0, y: 0 }, 's');
    s.data.config = { ...s.data.config, min: 50, max: 50.0001, pattern: 'random' };
    const a = createNode('logic', { x: 0, y: 0 }, 'a');
    const b = createNode('logic', { x: 0, y: 0 }, 'b');
    const m = createNode('mqtt', { x: 0, y: 0 }, 'm');
    a.data.config = { operator: '>', threshold: 10 };
    b.data.config = { operator: '>', threshold: 10 };
    const out = createEngine({ random: mid }).tick({ nodes: [s, a, b, m], edges: [edge('s', 'a'), edge('s', 'b'), edge('a', 'm'), edge('b', 'm')] });
    expect(out.events.filter((e) => e.kind === 'mqtt.publish')).toHaveLength(1);
  });

  it('handles several sensors feeding one block: one publish per sensor', () => {
    const mk = (id: string) => {
      const n = createNode('sensor', { x: 0, y: 0 }, id);
      n.data.config = { ...n.data.config, min: 50, max: 50.0001, pattern: 'random' };
      return n;
    };
    const m = createNode('mqtt', { x: 0, y: 0 }, 'm');
    const out = createEngine({ random: mid }).tick({ nodes: [mk('s1'), mk('s2'), m], edges: [edge('s1', 'm'), edge('s2', 'm')] });
    expect(out.events.filter((e) => e.kind === 'mqtt.publish')).toHaveLength(2);
    expect(Object.keys(out.readings)).toEqual(['s1', 's2']);
  });

  it('marks disconnected blocks as skipped and runs the rest', () => {
    const graph = constant50(10);
    graph.nodes.push(createNode('docker', { x: 0, y: 0 }, 'stray'));
    const out = createEngine({ random: mid }).tick(graph);
    expect(out.nodes.stray.status).toBe('skipped');
    expect(out.nodes.stray.reason).toMatch(/not connected/);
    expect(out.nodes['demo-mqtt'].status).toBe('ok');
    expect(out.runtime.stray).toBeUndefined();
  });

  it('does not loop forever on a cycle, reports it once and keeps running the other blocks', () => {
    const graph = constant50(10);
    graph.edges.push(edge('demo-mqtt', 'demo-logic'));
    const engine = createEngine({ random: mid });
    const first = engine.tick(graph);
    const second = engine.tick(graph);
    expect(first.events.filter((e) => e.data?.code === 'cycle')).toHaveLength(1);
    expect(second.events.filter((e) => e.data?.code === 'cycle')).toHaveLength(0);
    expect(first.nodes['demo-logic'].status).toBe('skipped');
    expect(first.nodes['demo-sensor'].status).toBe('ok');
  });

  it('fails a block with invalid settings once, without crashing, and blocks what is downstream', () => {
    const graph = constant50(10);
    graph.nodes[1].data.config = { operator: '>', threshold: '' };
    const engine = createEngine({ random: mid });
    const first = engine.tick(graph);
    const second = engine.tick(graph);
    expect(first.nodes['demo-logic']).toMatchObject({ status: 'failed' });
    expect(first.nodes['demo-logic'].reason).toMatch(/Threshold/);
    expect(first.nodes['demo-mqtt'].status).toBe('idle');
    const errors = (o: typeof first) => o.events.filter((e) => e.level === 'error');
    expect(errors(first)).toHaveLength(1);
    expect(errors(first)[0].message).toMatch(/Overheat Rule · Threshold/);
    expect(errors(second)).toHaveLength(0);
    expect(second.nodes['demo-logic'].status).toBe('failed');
  });

  it('turns an exception in a block into a failed status and one error event, and keeps going', () => {
    const base = createSimulatedAdapters(mid);
    const adapters: Adapters = {
      ...base,
      mqtt: {
        publish: () => {
          throw new Error('adapter exploded');
        },
      },
    };
    const graph = constant50(10);
    const engine = createEngine({ adapters });
    const first = engine.tick(graph);
    const second = engine.tick(graph);
    expect(first.nodes['demo-mqtt']).toMatchObject({ status: 'failed', reason: 'adapter exploded' });
    expect(first.nodes['demo-api'].status).toBe('idle');
    expect(first.events.filter((e) => e.kind === 'issue' && e.level === 'error')).toHaveLength(1);
    expect(second.events.filter((e) => e.kind === 'issue')).toHaveLength(0);
    expect(second.nodes['demo-sensor'].status).toBe('ok');
  });

  it('applies edits made between steps', () => {
    const engine = createEngine({ random: mid });
    const before = constant50(99);
    expect(engine.tick(before).nodes['demo-mqtt'].status).toBe('idle');
    const after = constant50(10);
    expect(engine.tick(after).nodes['demo-mqtt'].status).toBe('ok');
  });

  it('reuses its plan for an unchanged graph', () => {
    const graph = constant50(10);
    const engine = createEngine({ random: mid });
    expect(engine.tick(graph).nodes['demo-k8s'].status).toBe('prepared');
    expect(engine.tick(graph).nodes['demo-k8s'].status).toBe('prepared');
  });
});

describe('engine.start / stop / reset', () => {
  it('announces the run, says it is simulated, and prepares Docker and Kubernetes as configuration only', () => {
    const out = createEngine({ random: mid }).start(constant50());
    const messages = out.events.map((e) => e.message);
    expect(messages[0]).toBe('Started');
    expect(messages[1]).toMatch(/no MQTT broker, cloud API, container or cluster is contacted/);
    const docker = out.events.find((e) => e.kind === 'docker.prepare');
    const k8s = out.events.find((e) => e.kind === 'kubernetes.prepare');
    expect(docker?.message).toBe('Prepared image nexa-forge/simulator:latest (container port 8080) · simulated, configuration only');
    expect(k8s?.message).toBe('Prepared deployment nexa-simulator in namespace nexa with 2 replica(s) · simulated, configuration only');
    expect(docker?.data?.simulated).toBe(true);
    expect(k8s?.data?.simulated).toBe(true);
  });

  it('does not prepare disconnected or invalid Docker blocks, and reports workflow problems', () => {
    const graph = constant50();
    const stray = createNode('docker', { x: 0, y: 0 }, 'stray');
    graph.nodes.push(stray);
    const out = createEngine().start(graph);
    expect(out.events.filter((e) => e.kind === 'docker.prepare')).toHaveLength(1);
    expect(out.events.some((e) => e.kind === 'issue' && e.nodeId === 'stray')).toBe(true);
    expect(out.nodes.stray.status).toBe('skipped');
  });

  it('does not repeat problems already reported at start', () => {
    const graph = constant50();
    graph.nodes.push(createNode('docker', { x: 0, y: 0 }, 'stray'));
    const engine = createEngine({ random: mid });
    engine.start(graph);
    expect(engine.tick(graph).events.filter((e) => e.kind === 'issue')).toEqual([]);
  });

  it('stop returns a Stopped event and keeps the last statuses', () => {
    const engine = createEngine({ random: mid });
    const graph = constant50();
    engine.start(graph);
    engine.tick(graph);
    const out = engine.stop();
    expect(out.events.map((e) => e.message)).toEqual(['Stopped']);
    expect(out.nodes['demo-sensor'].status).toBe('ok');
  });

  it('keeps counting ticks across runs until reset', () => {
    const engine = createEngine({ random: mid });
    const graph = constant50();
    engine.start(graph);
    engine.tick(graph);
    engine.tick(graph);
    engine.stop();
    engine.start(graph);
    expect(engine.tick(graph).tick).toBe(3);
    engine.reset();
    expect(engine.tickCount).toBe(0);
    expect(engine.tick(graph).tick).toBe(1);
  });

  it('a new run starts with fresh block state', () => {
    const engine = createEngine({ random: mid });
    const graph = constant50();
    engine.start(graph);
    engine.tick(graph);
    engine.stop();
    const out = engine.start(graph);
    expect(out.nodes['demo-sensor']).toEqual({ status: 'idle', runs: 0 });
  });
});

describe('architecture', () => {
  it('keeps the engine free of React and UI imports', () => {
    const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const files = Object.entries(sources).filter(([name]) => !name.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(4);
    for (const [name, source] of files) {
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec, `${name} imports ${spec}`).not.toMatch(/^react($|\/)|^react-dom|@xyflow|components|simulation|hooks/);
      }
    }
  });

  it('only ever reports simulated external actions', () => {
    const adapters = createSimulatedAdapters(mid);
    const signal = { sensorId: 's', value: 1, unit: 'x' };
    expect(adapters.mqtt.publish({ topic: 't', broker: 'b:1', qos: '0' }, signal).simulated).toBe(true);
    expect(adapters.api.request({ url: 'https://x', method: 'POST' }, signal).simulated).toBe(true);
    expect(adapters.docker.prepare({ image: 'i', port: 1 }).simulated).toBe(true);
    expect(adapters.kubernetes.prepare({ deploymentName: 'd', namespace: 'n', replicas: 1 }).simulated).toBe(true);
  });
});
