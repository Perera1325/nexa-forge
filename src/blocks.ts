import type { BlockKind, NodeConfig } from './types';

export const DRAG_MIME = 'application/x-nexa-block';

export type BlockCategory = 'Sources' | 'Processing' | 'Connectivity' | 'Deployment';
export const CATEGORIES: BlockCategory[] = ['Sources', 'Processing', 'Connectivity', 'Deployment'];

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  hint?: string;
  placeholder?: string;
}

export interface BlockDef {
  kind: BlockKind;
  category: BlockCategory;
  title: string;
  description: string;
  hasInput: boolean;
  hasOutput: boolean;
  fields: FieldDef[];
  defaults: NodeConfig;
  /** Key/value rows shown on the node card. */
  rows: (config: NodeConfig) => Array<[string, string]>;
}

export const BLOCKS: Record<BlockKind, BlockDef> = {
  sensor: {
    kind: 'sensor',
    category: 'Sources',
    title: 'Virtual Sensor',
    description: 'Generates simulated readings from mock data.',
    hasInput: false,
    hasOutput: true,
    fields: [
      { key: 'sensorType', label: 'Sensor type', type: 'select', options: ['temperature', 'humidity', 'vibration', 'voltage'], hint: 'Kind of signal being simulated.' },
      { key: 'unit', label: 'Unit', type: 'text', hint: 'Display unit, for example °C or V.' },
      { key: 'min', label: 'Minimum', type: 'number', hint: 'Lower bound of generated values.' },
      { key: 'max', label: 'Maximum', type: 'number', hint: 'Upper bound of generated values.' },
      { key: 'pattern', label: 'Data pattern', type: 'select', options: ['sine', 'random', 'ramp'], hint: 'sine: smooth wave · random: uniform noise · ramp: repeating sawtooth.' },
    ],
    defaults: { sensorType: 'temperature', unit: '°C', min: 20, max: 90, pattern: 'sine' },
    rows: (c) => [
      ['Type', String(c.sensorType)],
      ['Range', `${c.min} – ${c.max} ${c.unit}`],
      ['Pattern', String(c.pattern)],
    ],
  },
  logic: {
    kind: 'logic',
    category: 'Processing',
    title: 'Logic',
    description: 'Passes data downstream only when a condition is true.',
    hasInput: true,
    hasOutput: true,
    fields: [
      { key: 'operator', label: 'Operator', type: 'select', options: ['>', '<', '>=', '<=', '=='], hint: 'Comparison applied to the incoming value.' },
      { key: 'threshold', label: 'Threshold', type: 'number', hint: 'Value the input is compared against.' },
    ],
    defaults: { operator: '>', threshold: 70 },
    rows: (c) => [['Condition', `value ${c.operator} ${c.threshold}`]],
  },
  mqtt: {
    kind: 'mqtt',
    category: 'Connectivity',
    title: 'MQTT',
    description: 'Publishes messages to an MQTT broker topic.',
    hasInput: true,
    hasOutput: true,
    fields: [
      { key: 'broker', label: 'Broker', type: 'text', placeholder: 'localhost:1883', hint: 'Address as host:port.' },
      { key: 'topic', label: 'Topic', type: 'text', placeholder: 'site/area/telemetry', hint: 'Messages are published to this topic.' },
      { key: 'qos', label: 'QoS', type: 'select', options: ['0', '1', '2'], hint: '0: at most once · 1: at least once · 2: exactly once.' },
    ],
    defaults: { broker: 'localhost:1883', topic: 'nexa/factory/telemetry', qos: '0' },
    rows: (c) => [
      ['Broker', String(c.broker)],
      ['Topic', String(c.topic)],
    ],
  },
  cloudApi: {
    kind: 'cloudApi',
    category: 'Connectivity',
    title: 'Cloud API',
    description: 'Sends data to an HTTP(S) endpoint.',
    hasInput: true,
    hasOutput: true,
    fields: [
      { key: 'url', label: 'Endpoint URL', type: 'text', placeholder: 'https://api.example.com/v1/telemetry', hint: 'Full http(s) URL that receives the data.' },
      { key: 'method', label: 'Method', type: 'select', options: ['POST', 'PUT'] },
    ],
    defaults: { url: 'https://api.example.com/v1/telemetry', method: 'POST' },
    rows: (c) => [
      ['Method', String(c.method)],
      ['Endpoint', String(c.url)],
    ],
  },
  docker: {
    kind: 'docker',
    category: 'Deployment',
    title: 'Docker',
    description: 'Packages the service as a container image.',
    hasInput: true,
    hasOutput: true,
    fields: [
      { key: 'image', label: 'Image', type: 'text', placeholder: 'registry/name:tag', hint: 'Container image name and tag.' },
      { key: 'port', label: 'Container port', type: 'number', hint: 'Port the service listens on (1–65535).' },
    ],
    defaults: { image: 'nexa-forge/simulator:latest', port: 8080 },
    rows: (c) => [
      ['Image', String(c.image)],
      ['Port', String(c.port)],
    ],
  },
  kubernetes: {
    kind: 'kubernetes',
    category: 'Deployment',
    title: 'Kubernetes',
    description: 'Deploys the container to a Kubernetes cluster.',
    hasInput: true,
    hasOutput: false,
    fields: [
      { key: 'deploymentName', label: 'Deployment name', type: 'text', hint: 'Lowercase letters, digits and dashes.' },
      { key: 'namespace', label: 'Namespace', type: 'text', hint: 'Lowercase letters, digits and dashes.' },
      { key: 'replicas', label: 'Replicas', type: 'number', hint: 'Number of pod copies to run.' },
    ],
    defaults: { deploymentName: 'nexa-simulator', namespace: 'nexa', replicas: 2 },
    rows: (c) => [
      ['Deployment', `${c.namespace}/${c.deploymentName}`],
      ['Replicas', String(c.replicas)],
    ],
  },
};

export const BLOCK_ORDER: BlockKind[] = ['sensor', 'logic', 'mqtt', 'cloudApi', 'docker', 'kubernetes'];
