import type { BlockKind, NodeConfig } from './types';

export const DRAG_MIME = 'application/x-nexa-block';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

export interface BlockDef {
  kind: BlockKind;
  group: string;
  title: string;
  description: string;
  code: string;
  accent: string;
  hasInput: boolean;
  hasOutput: boolean;
  fields: FieldDef[];
  defaults: NodeConfig;
  summary: (config: NodeConfig) => string;
}

export const BLOCKS: Record<BlockKind, BlockDef> = {
  sensor: {
    kind: 'sensor',
    group: 'Edge & Data',
    title: 'Virtual Sensor',
    description: 'Simulated sensor producing mock readings',
    code: 'SN',
    accent: '#2dd4bf',
    hasInput: false,
    hasOutput: true,
    fields: [
      { key: 'sensorType', label: 'Sensor type', type: 'select', options: ['temperature', 'humidity', 'vibration', 'voltage'] },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'min', label: 'Min value', type: 'number' },
      { key: 'max', label: 'Max value', type: 'number' },
      { key: 'pattern', label: 'Data pattern', type: 'select', options: ['sine', 'random', 'ramp'] },
    ],
    defaults: { sensorType: 'temperature', unit: '°C', min: 20, max: 90, pattern: 'sine' },
    summary: (c) => `${c.sensorType} · ${c.min}–${c.max} ${c.unit}`,
  },
  logic: {
    kind: 'logic',
    group: 'Edge & Data',
    title: 'Logic',
    description: 'Threshold rule: pass data on when true',
    code: 'IF',
    accent: '#a78bfa',
    hasInput: true,
    hasOutput: true,
    fields: [
      { key: 'operator', label: 'Operator', type: 'select', options: ['>', '<', '>=', '<=', '=='] },
      { key: 'threshold', label: 'Threshold', type: 'number' },
    ],
    defaults: { operator: '>', threshold: 70 },
    summary: (c) => `value ${c.operator} ${c.threshold}`,
  },
  mqtt: {
    kind: 'mqtt',
    group: 'Edge & Data',
    title: 'MQTT',
    description: 'Publish messages to an MQTT broker',
    code: 'MQ',
    accent: '#fbbf24',
    hasInput: true,
    hasOutput: true,
    fields: [
      { key: 'broker', label: 'Broker (host:port)', type: 'text' },
      { key: 'topic', label: 'Topic', type: 'text' },
      { key: 'qos', label: 'QoS', type: 'select', options: ['0', '1', '2'] },
    ],
    defaults: { broker: 'localhost:1883', topic: 'nexa/factory/telemetry', qos: '0' },
    summary: (c) => `${c.topic}`,
  },
  cloudApi: {
    kind: 'cloudApi',
    group: 'Cloud & Infra',
    title: 'Cloud API',
    description: 'Send data to an HTTP endpoint',
    code: 'API',
    accent: '#38bdf8',
    hasInput: true,
    hasOutput: true,
    fields: [
      { key: 'url', label: 'Endpoint URL', type: 'text' },
      { key: 'method', label: 'Method', type: 'select', options: ['POST', 'PUT'] },
    ],
    defaults: { url: 'https://api.example.com/v1/telemetry', method: 'POST' },
    summary: (c) => `${c.method} ${c.url}`,
  },
  docker: {
    kind: 'docker',
    group: 'Cloud & Infra',
    title: 'Docker',
    description: 'Containerise the service',
    code: 'DK',
    accent: '#3b82f6',
    hasInput: true,
    hasOutput: true,
    fields: [
      { key: 'image', label: 'Image name', type: 'text' },
      { key: 'port', label: 'Container port', type: 'number' },
    ],
    defaults: { image: 'nexa-forge/simulator:latest', port: 8080 },
    summary: (c) => `${c.image}`,
  },
  kubernetes: {
    kind: 'kubernetes',
    group: 'Cloud & Infra',
    title: 'Kubernetes',
    description: 'Deploy to a Kubernetes cluster',
    code: 'K8',
    accent: '#fb7185',
    hasInput: true,
    hasOutput: false,
    fields: [
      { key: 'deploymentName', label: 'Deployment name', type: 'text' },
      { key: 'namespace', label: 'Namespace', type: 'text' },
      { key: 'replicas', label: 'Replicas', type: 'number' },
    ],
    defaults: { deploymentName: 'nexa-simulator', namespace: 'nexa', replicas: 2 },
    summary: (c) => `${c.namespace}/${c.deploymentName} ×${c.replicas}`,
  },
};

export const BLOCK_ORDER: BlockKind[] = ['sensor', 'logic', 'mqtt', 'cloudApi', 'docker', 'kubernetes'];
