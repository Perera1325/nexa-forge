import { describe, expect, it } from 'vitest';
import { computeRoutes, generateProject } from './generator';
import { createDemoWorkflow, createNode } from './nodes';
import { createEngine } from '../engine';
import { createZip } from './zip';

const byPath = (files: ReturnType<typeof generateProject>) => Object.fromEntries(files.map((f) => [f.path, f.content]));

describe('generateProject', () => {
  it('generates the expected files for the example workflow', () => {
    const { nodes, edges } = createDemoWorkflow();
    const files = byPath(generateProject('Demo', nodes, edges));
    expect(Object.keys(files).sort()).toEqual(
      [
        '.gitignore',
        'Dockerfile',
        'README.md',
        'docker-compose.yml',
        'k8s/deployment.yaml',
        'k8s/namespace.yaml',
        'k8s/service.yaml',
        'requirements.txt',
        'simulator/config.json',
        'simulator/simulator.py',
        'workflow.json',
      ].sort(),
    );
  });

  it('writes valid JSON config and workflow files', () => {
    const { nodes, edges } = createDemoWorkflow();
    const files = byPath(generateProject('Demo', nodes, edges));
    const config = JSON.parse(files['simulator/config.json']);
    expect(config.sensors).toHaveLength(1);
    expect(config.rules[0]).toMatchObject({ id: 'demo-logic', threshold: 70 });
    expect(config.routes).toContainEqual({ sensor: 'demo-sensor', via: ['demo-logic'], target: 'mqtt' });
    expect(JSON.parse(files['workflow.json']).schema).toBe('nexa-forge/workflow');
  });

  it('never embeds user text in executable Python source', () => {
    const { nodes, edges } = createDemoWorkflow();
    nodes[0].data.label = "x''' ; import os ; os.system('boom') ; '''";
    const files = byPath(generateProject('Demo', nodes, edges));
    expect(files['simulator/simulator.py']).not.toContain('os.system');
    expect(files['simulator/config.json']).toContain('os.system'); // data only, loaded with json.loads
  });

  it('quotes values placed in YAML so they cannot inject fields', () => {
    const { nodes, edges } = createDemoWorkflow();
    const docker = nodes.find((n) => n.data.kind === 'docker');
    if (!docker) throw new Error('example has a Docker block');
    docker.data.config.image = 'img:1\n    privileged: true';
    const files = byPath(generateProject('Demo', nodes, edges));
    expect(files['docker-compose.yml']).toContain('image: "img:1\\n    privileged: true"');
    expect(files['docker-compose.yml']).not.toMatch(/^\s+privileged:/m);
    expect(files['k8s/deployment.yaml']).not.toMatch(/^\s+privileged:/m);
  });

  it('is honest and avoids secrets in the generated README and Docker files', () => {
    const { nodes, edges } = createDemoWorkflow();
    const files = byPath(generateProject('Demo', nodes, edges));
    expect(files['README.md']).toMatch(/simulated/i);
    expect(files['README.md']).toMatch(/not been security-reviewed/);
    expect(files['Dockerfile']).toContain('USER nexa');
    expect(files['docker-compose.yml']).toContain('127.0.0.1:1883');
    expect(Object.values(files).join('\n')).not.toMatch(/(password|secret|token|api[_-]?key)\s*[:=]\s*\S/i);
  });

  it('generates a self-explanatory README: structure, config, run steps, simulated parts, limits', () => {
    const { nodes, edges } = createDemoWorkflow();
    const readme = byPath(generateProject('Demo', nodes, edges))['README.md'];
    for (const heading of ['What is real and what is simulated', 'Folder structure', 'Requirements', 'Run the simulator', 'Configuration', 'Docker', 'Kubernetes', 'Limitations']) {
      expect(readme).toContain(`## ${heading}`);
    }
    expect(readme).toContain('python simulator/simulator.py --ticks 10');
    expect(readme).toContain('`simulator/config.json`');
    expect(readme).toContain('| `MQTT_BROKER` |');
    expect(readme).toContain('**Boiler Temperature** → MQTT topic `nexa/factory/telemetry`, only when **Overheat Rule** passes');
    expect(readme).toMatch(/No real hardware/);
    expect(readme).not.toMatch(/deploys? to (a )?(real|production)|supports? (real )?hardware/i);
  });

  it('leaves Docker and Kubernetes sections out when the workflow has no such blocks', () => {
    const { nodes } = createDemoWorkflow();
    const readme = byPath(generateProject('Tiny', nodes.filter((n) => n.data.kind === 'sensor'), []))['README.md'];
    expect(readme).not.toContain('## Docker');
    expect(readme).not.toContain('## Kubernetes');
    expect(readme).toContain('No sensor is connected to an MQTT or Cloud API block');
  });

  it('does not let a project name or block label break the README layout', () => {
    const { nodes, edges } = createDemoWorkflow();
    nodes[0].data.label = 'Evil`\n## Injected';
    const readme = byPath(generateProject('Name\n# Injected', nodes, edges))['README.md'];
    expect(readme).not.toMatch(/^## Injected/m);
    expect(readme).not.toMatch(/^# Injected/m);
  });

  it('keeps the generated simulator offline unless sending is requested', () => {
    const { nodes, edges } = createDemoWorkflow();
    const files = byPath(generateProject('Demo', nodes, edges));
    const py = files['simulator/simulator.py'];
    expect(py).toContain('--send-mqtt');
    expect(py).toContain('--send-api');
    expect(py).toContain('args.send_api and "api" in open_targets');
    expect(py).toContain('connect_mqtt() if args.send_mqtt else None');
    expect(files['docker-compose.yml']).toContain('"--send-mqtt"');
    expect(files['k8s/deployment.yaml']).toContain('command: ["python", "-u", "simulator/simulator.py", "--send-mqtt"]');
    expect(files['Dockerfile']).not.toContain('--send');
    expect(files['requirements.txt']).toContain('paho-mqtt');
  });

  it('generates only what the workflow contains', () => {
    const { nodes, edges } = createDemoWorkflow();
    const sensorOnly = nodes.filter((n) => n.data.kind === 'sensor');
    const files = byPath(generateProject('Tiny', sensorOnly, []));
    expect(files['Dockerfile']).toBeUndefined();
    expect(files['k8s/deployment.yaml']).toBeUndefined();
    expect(JSON.parse(files['simulator/config.json']).mqtt).toBeNull();
    expect(edges.length).toBeGreaterThan(0);
  });

  it('packs into a ZIP with a local header and an end-of-central-directory record', async () => {
    const { nodes, edges } = createDemoWorkflow();
    const files = generateProject('Demo', nodes, edges);
    const bytes = new Uint8Array(await createZip(files).arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const view = new DataView(bytes.buffer);
    const eocd = bytes.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(files.length);
  });
});

describe('computeRoutes (generated simulator follows the editor model)', () => {
  const fixed = (threshold: number) => {
    const wf = createDemoWorkflow();
    wf.nodes[0].data.config = { ...wf.nodes[0].data.config, min: 50, max: 50.0001, pattern: 'random' };
    wf.nodes[1].data.config = { operator: '>', threshold };
    return wf;
  };
  const nodeOf = (nodes: ReturnType<typeof createDemoWorkflow>['nodes'], kind: string) => nodes.find((n) => n.data.kind === kind);

  it('routes MQTT and the API behind the Logic block in the example', () => {
    const { nodes, edges } = fixed(10);
    const routes = computeRoutes(nodes, edges, nodeOf(nodes, 'mqtt'), nodeOf(nodes, 'cloudApi'));
    expect(routes).toEqual([
      { sensor: 'demo-sensor', via: ['demo-logic'], target: 'mqtt' },
      { sensor: 'demo-sensor', via: ['demo-logic'], target: 'api' },
    ]);
  });

  it('creates no routes for blocks that are not connected', () => {
    const s = createNode('sensor', { x: 0, y: 0 }, 's');
    const m = createNode('mqtt', { x: 1, y: 0 }, 'm');
    const api = createNode('cloudApi', { x: 2, y: 0 }, 'api');
    const lonely = createNode('logic', { x: 3, y: 0 }, 'l');
    const routes = computeRoutes([s, m, api, lonely], [{ id: 'e', source: 's', target: 'm' }], m, api);
    expect(routes).toEqual([{ sensor: 's', via: [], target: 'mqtt' }]);
  });

  it('terminates on cycles', () => {
    const { nodes, edges } = fixed(10);
    const loop = { id: 'loop', source: 'demo-mqtt', target: 'demo-logic' };
    expect(() => computeRoutes(nodes, [...edges, loop], nodeOf(nodes, 'mqtt'), nodeOf(nodes, 'cloudApi'))).not.toThrow();
  });

  it('agrees with the editor simulation about what reaches MQTT and the API', () => {
    for (const threshold of [10, 49, 99]) {
      const { nodes, edges } = fixed(threshold);
      const mqtt = nodeOf(nodes, 'mqtt');
      const api = nodeOf(nodes, 'cloudApi');
      const sim = createEngine().tick({ nodes, edges });
      const value = sim.readings['demo-sensor'];
      const passes = value > threshold;
      const reaches = (target: 'mqtt' | 'api') =>
        computeRoutes(nodes, edges, mqtt, api).some((r) => r.target === target && r.via.every(() => passes));
      expect(reaches('mqtt')).toBe(sim.events.some((m) => m.message.startsWith('PUBLISH')));
      expect(reaches('api')).toBe(sim.events.some((m) => m.message.startsWith('POST')));
    }
  });

  it('falls back to defaults instead of writing invalid numbers into the config', () => {
    const { nodes, edges } = createDemoWorkflow();
    nodes[0].data.config.min = '';
    nodes[1].data.config.threshold = '';
    const config = JSON.parse(byPath(generateProject('X', nodes, edges))['simulator/config.json']);
    expect(config.sensors[0].min).toBe(20);
    expect(config.rules[0].threshold).toBe(70);
  });
});

