import { describe, expect, it } from 'vitest';
import { generateProject } from './generator';
import { createDemoWorkflow } from './nodes';
import { createZip } from './zip';

const byPath = (files: ReturnType<typeof generateProject>) => Object.fromEntries(files.map((f) => [f.path, f.content]));

describe('generateProject', () => {
  it('generates the expected files for the example workflow', () => {
    const { nodes, edges } = createDemoWorkflow();
    const files = byPath(generateProject('Demo', nodes, edges));
    expect(Object.keys(files).sort()).toEqual(
      [
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
    expect(config.rules[0].sensor).toBe('demo-sensor');
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
