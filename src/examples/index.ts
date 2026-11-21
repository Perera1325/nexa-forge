import { createDemoWorkflow, createNode } from '../lib/nodes';
import type { BlockKind, NexaEdge, NexaNode, NodeConfig } from '../types';

/** A ready-made workflow that can be loaded onto the canvas. Software only: every sensor is a virtual sensor. */
export interface WorkflowExample {
  id: string;
  /** Used as the project name when the example is loaded. */
  name: string;
  title: string;
  summary: string;
  /** What the example demonstrates, one short point each. */
  teaches: string[];
  build(): { nodes: NexaNode[]; edges: NexaEdge[] };
}

interface BlockSpec {
  id: string;
  kind: BlockKind;
  label: string;
  at: [number, number];
  config?: NodeConfig;
}

/** Builds nodes and connections from a compact description. `links` are [source, target] pairs of block ids. */
function assemble(blocks: BlockSpec[], links: Array<[string, string]>): { nodes: NexaNode[]; edges: NexaEdge[] } {
  const nodes = blocks.map((b) => {
    const node = createNode(b.kind, { x: b.at[0], y: b.at[1] }, b.id);
    node.data.label = b.label;
    node.data.config = { ...node.data.config, ...b.config };
    return node;
  });
  const edges = links.map(([source, target]): NexaEdge => ({ id: `e-${source}-${target}`, source, target }));
  return { nodes, edges };
}

const temperature: WorkflowExample = {
  id: 'smart-temperature',
  name: 'Smart Temperature Monitoring',
  title: 'Smart Temperature Monitoring',
  summary: 'A room temperature reading is checked against a limit. Only readings above it are published and reported.',
  teaches: ['Configure a Virtual Sensor (range, unit, pattern)', 'Use one Logic rule as a filter', 'Send filtered data to MQTT and a Cloud API'],
  build: () =>
    assemble(
      [
        { id: 'temp-sensor', kind: 'sensor', label: 'Room Temperature', at: [0, 0], config: { sensorType: 'temperature', unit: '°C', min: 15, max: 40, pattern: 'sine' } },
        { id: 'temp-rule', kind: 'logic', label: 'Too Warm', at: [300, 0], config: { operator: '>', threshold: 30 } },
        { id: 'temp-mqtt', kind: 'mqtt', label: 'Publish Alert', at: [600, 0], config: { broker: 'localhost:1883', topic: 'building/floor1/room1/temperature', qos: '1' } },
        { id: 'temp-api', kind: 'cloudApi', label: 'Report Alert', at: [900, 0], config: { url: 'https://api.example.com/v1/alerts', method: 'POST' } },
      ],
      [
        ['temp-sensor', 'temp-rule'],
        ['temp-rule', 'temp-mqtt'],
        ['temp-mqtt', 'temp-api'],
      ],
    ),
};

const energy: WorkflowExample = {
  id: 'energy-monitoring',
  name: 'Energy Monitoring and Alerting',
  title: 'Energy Monitoring and Alerting',
  summary: 'Every voltage reading is logged to an API, while readings above a safe limit are also published as alerts.',
  teaches: ['Branch one sensor into two paths', 'Send every reading to one block and only alerts to another', 'Choose the random data pattern'],
  build: () =>
    assemble(
      [
        { id: 'energy-sensor', kind: 'sensor', label: 'Mains Voltage', at: [0, 100], config: { sensorType: 'voltage', unit: 'V', min: 200, max: 250, pattern: 'sine' } },
        { id: 'energy-rule', kind: 'logic', label: 'Overvoltage Rule', at: [300, 0], config: { operator: '>', threshold: 238 } },
        { id: 'energy-mqtt', kind: 'mqtt', label: 'Publish Overvoltage', at: [600, 0], config: { broker: 'localhost:1883', topic: 'energy/site1/alerts/overvoltage', qos: '1' } },
        { id: 'energy-api', kind: 'cloudApi', label: 'Log Every Reading', at: [600, 250], config: { url: 'https://api.example.com/v1/energy/readings', method: 'POST' } },
      ],
      [
        ['energy-sensor', 'energy-rule'],
        ['energy-rule', 'energy-mqtt'],
        ['energy-sensor', 'energy-api'],
      ],
    ),
};

const pipeline: WorkflowExample = {
  id: 'edge-to-cloud',
  name: 'Edge-to-Cloud Data Pipeline',
  title: 'Edge-to-Cloud Data Pipeline',
  summary: 'A vibration signal is filtered, published, sent to a cloud endpoint, and the service is described as a container and a deployment.',
  teaches: ['Use all six block types in one chain', 'See what the Docker and Kubernetes blocks add to a generated project', 'Use the ramp data pattern'],
  build: () =>
    assemble(
      [
        { id: 'edge-sensor', kind: 'sensor', label: 'Pump Vibration', at: [0, 0], config: { sensorType: 'vibration', unit: 'mm/s', min: 0, max: 10, pattern: 'ramp' } },
        { id: 'edge-rule', kind: 'logic', label: 'High Vibration', at: [300, 0], config: { operator: '>=', threshold: 6 } },
        { id: 'edge-mqtt', kind: 'mqtt', label: 'Edge Gateway Topic', at: [600, 0], config: { broker: 'localhost:1883', topic: 'plant/pump1/vibration', qos: '0' } },
        { id: 'edge-api', kind: 'cloudApi', label: 'Cloud Ingest', at: [0, 250], config: { url: 'https://api.example.com/v1/vibration', method: 'POST' } },
        { id: 'edge-docker', kind: 'docker', label: 'Pipeline Image', at: [300, 250], config: { image: 'nexa-forge/edge-pipeline:0.1', port: 8080 } },
        { id: 'edge-k8s', kind: 'kubernetes', label: 'Pipeline Deployment', at: [600, 250], config: { deploymentName: 'edge-pipeline', namespace: 'edge', replicas: 2 } },
      ],
      [
        ['edge-sensor', 'edge-rule'],
        ['edge-rule', 'edge-mqtt'],
        ['edge-mqtt', 'edge-api'],
        ['edge-api', 'edge-docker'],
        ['edge-docker', 'edge-k8s'],
      ],
    ),
};

const basic: WorkflowExample = {
  id: 'getting-started',
  name: 'Factory Temperature Monitor',
  title: 'Basic Overheat Chain',
  summary: 'The smallest complete workflow with every block type, a good first one to run.',
  teaches: ['Follow data from a sensor to a deployment', 'Run the simulation and read the Event Log'],
  build: createDemoWorkflow,
};

/** Ordered for the gallery: the three scenarios first, the basic chain last. */
export const EXAMPLES: WorkflowExample[] = [temperature, energy, pipeline, basic];

export const getExample = (id: string): WorkflowExample | undefined => EXAMPLES.find((e) => e.id === id);
