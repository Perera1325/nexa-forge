import { describe, expect, it } from 'vitest';
import { createDemoWorkflow, createNode } from './nodes';
import { buildWorkflow, parseWorkflow, validateConfig, validateWorkflow, WORKFLOW_SCHEMA, WORKFLOW_VERSION } from './workflow';

const demo = () => createDemoWorkflow();
const exported = () => {
  const { nodes, edges } = demo();
  return JSON.stringify(buildWorkflow('Test project', nodes, edges));
};
const mutate = (fn: (doc: Record<string, any>) => void) => {
  const doc = JSON.parse(exported());
  fn(doc);
  return JSON.stringify(doc);
};

describe('workflow serialization', () => {
  it('exports a versioned document with metadata', () => {
    const { nodes, edges } = demo();
    const doc = buildWorkflow('My flow', nodes, edges);
    expect(doc.schema).toBe(WORKFLOW_SCHEMA);
    expect(doc.version).toBe(WORKFLOW_VERSION);
    expect(doc.name).toBe('My flow');
    expect(doc.nodes).toHaveLength(6);
    expect(doc.edges).toHaveLength(5);
    expect(Number.isNaN(Date.parse(doc.exportedAt))).toBe(false);
  });

  it('round-trips through export and import without losing data', () => {
    const { nodes, edges } = demo();
    const result = parseWorkflow(JSON.stringify(buildWorkflow('Round trip', nodes, edges)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe('Round trip');
    expect(result.warnings).toEqual([]);
    expect(result.nodes.map((n) => [n.id, n.data.kind, n.data.label, n.data.config])).toEqual(
      nodes.map((n) => [n.id, n.data.kind, n.data.label, n.data.config]),
    );
    expect(result.edges.map((e) => [e.source, e.target])).toEqual(edges.map((e) => [e.source, e.target]));
  });
});

describe('parseWorkflow (untrusted input)', () => {
  const failsWith = (text: string, pattern: RegExp) => {
    const result = parseWorkflow(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
  };

  it('rejects malformed JSON, wrong shapes and wrong schemas', () => {
    failsWith('{not json', /not valid JSON/);
    failsWith('[]', /JSON object/);
    failsWith('null', /JSON object/);
    failsWith('{"schema":"something-else","version":1,"nodes":[],"edges":[]}', /not a NEXA Forge/);
  });

  it('rejects missing, invalid and newer versions', () => {
    failsWith(mutate((d) => delete d.version), /version/);
    failsWith(mutate((d) => (d.version = 0)), /version/);
    failsWith(mutate((d) => (d.version = 'one')), /version/);
    failsWith(mutate((d) => (d.version = WORKFLOW_VERSION + 1)), /newer/);
  });

  it('rejects oversized input and non-array nodes', () => {
    failsWith('x'.repeat(1_000_001), /too large/);
    failsWith(mutate((d) => (d.nodes = {})), /arrays/);
  });

  it('rejects duplicate ids, missing ids and unknown block kinds', () => {
    failsWith(mutate((d) => (d.nodes[1].id = d.nodes[0].id)), /Duplicate/);
    failsWith(mutate((d) => delete d.nodes[0].id), /invalid "id"/);
    failsWith(mutate((d) => (d.nodes[0].kind = 'constructor')), /unknown type/);
    failsWith(mutate((d) => (d.nodes[0].kind = 'rocket')), /unknown type/);
  });

  it('drops invalid connections and reports them', () => {
    const text = mutate((d) => {
      d.edges.push({ source: 'demo-sensor', target: 'missing' });
      d.edges.push({ source: 'demo-k8s', target: 'demo-logic' }); // Kubernetes has no output
      d.edges.push({ source: 'demo-logic', target: 'demo-sensor' }); // Sensor has no input
      d.edges.push({ source: 'demo-logic', target: 'demo-logic' });
      d.edges.push({ source: 'demo-sensor', target: 'demo-logic' }); // duplicate
    });
    const result = parseWorkflow(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.edges).toHaveLength(5);
    expect(result.warnings.join(' ')).toMatch(/5 invalid or duplicate connections were ignored/);
  });

  it('fixes recoverable problems with warnings', () => {
    const result = parseWorkflow(
      mutate((d) => {
        delete d.nodes[0].label;
        d.nodes[1].position = { x: 'a', y: null };
        d.nodes[2].config = 'not an object';
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBe(2);
    expect(result.nodes[0].data.label).toBe('Virtual Sensor');
    expect(result.nodes[1].position).toEqual({ x: 0, y: 0 });
    expect(result.nodes[2].data.config.topic).toBe('nexa/factory/telemetry');
  });

  it('copies only known, correctly typed config values', () => {
    const result = parseWorkflow(
      mutate((d) => {
        d.nodes[0].config = { min: 'oops', max: 120, pattern: 'not-an-option', unit: 'V', __proto__: { polluted: true }, evil: '<script>' };
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const config = result.nodes[0].data.config;
    expect(config.min).toBe(20); // wrong type -> default
    expect(config.max).toBe(120);
    expect(config.pattern).toBe('sine'); // not in options -> default
    expect(config.unit).toBe('V');
    expect('evil' in config).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('truncates very long labels', () => {
    const result = parseWorkflow(mutate((d) => (d.nodes[0].label = 'x'.repeat(500))));
    expect(result.ok && result.nodes[0].data.label.length).toBe(80);
  });

  it('accepts an empty workflow', () => {
    const result = parseWorkflow(JSON.stringify({ schema: WORKFLOW_SCHEMA, version: WORKFLOW_VERSION, nodes: [], edges: [] }));
    expect(result).toMatchObject({ ok: true, name: 'Untitled project', nodes: [], edges: [] });
  });
});

describe('validation', () => {
  it('flags invalid sensor ranges', () => {
    expect(validateConfig('sensor', { min: 10, max: 5 }).max).toMatch(/greater/);
    expect(validateConfig('sensor', { min: '', max: 5 }).min).toBeDefined();
    expect(validateConfig('sensor', { min: 0, max: 5 })).toEqual({});
  });

  it('flags bad broker, URL, port and Kubernetes names', () => {
    expect(validateConfig('mqtt', { broker: 'no-port', topic: 'a' }).broker).toBeDefined();
    expect(validateConfig('mqtt', { broker: 'host:1883', topic: ' ' }).topic).toBeDefined();
    expect(validateConfig('cloudApi', { url: 'ftp://x' }).url).toBeDefined();
    expect(validateConfig('cloudApi', { url: 'javascript:alert(1)' }).url).toBeDefined();
    expect(validateConfig('docker', { image: 'a', port: 70000 }).port).toBeDefined();
    expect(validateConfig('kubernetes', { deploymentName: 'Bad_Name', namespace: 'ok', replicas: 1 }).deploymentName).toBeDefined();
    expect(validateConfig('kubernetes', { deploymentName: 'ok', namespace: 'ok', replicas: 0 }).replicas).toBeDefined();
  });

  it('reports no issues for the example workflow and none for an empty canvas', () => {
    const { nodes, edges } = demo();
    expect(validateWorkflow(nodes, edges)).toEqual([]);
    expect(validateWorkflow([], [])).toEqual([]);
  });

  it('detects disconnected blocks and a missing sensor', () => {
    const lonely = createNode('docker', { x: 0, y: 0 }, 'd1');
    const issues = validateWorkflow([lonely], []);
    expect(issues.map((i) => i.message).join(' ')).toMatch(/No data source/);
    expect(issues.some((i) => i.nodeId === 'd1' && /no incoming/.test(i.message))).toBe(true);
  });

  it('reports configuration errors as errors with the block id', () => {
    const sensor = createNode('sensor', { x: 0, y: 0 }, 's1');
    sensor.data.config.max = 1;
    sensor.data.config.min = 5;
    const issues = validateWorkflow([sensor], []);
    expect(issues.some((i) => i.level === 'error' && i.nodeId === 's1')).toBe(true);
  });
});
