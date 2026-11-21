import { BLOCKS } from '../blocks';
import type { BlockKind, ConfigValue, NexaEdge, NexaNode, NodeConfig, WorkflowIssue } from '../types';

export interface WorkflowDocument {
  schema: 'nexa-forge/workflow';
  version: 1;
  name: string;
  exportedAt: string;
  nodes: Array<{
    id: string;
    kind: BlockKind;
    label: string;
    position: { x: number; y: number };
    config: NodeConfig;
  }>;
  edges: Array<{ id: string; source: string; target: string }>;
}

export function buildWorkflow(name: string, nodes: NexaNode[], edges: NexaEdge[]): WorkflowDocument {
  return {
    schema: 'nexa-forge/workflow',
    version: 1,
    name,
    exportedAt: new Date().toISOString(),
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      label: n.data.label,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      config: n.data.config,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const toNumber = (v: ConfigValue | undefined) => (v === undefined || v === '' ? Number.NaN : Number(v));

/** Field-level validation: returns an error message per invalid config key. */
export function validateConfig(kind: BlockKind, c: NodeConfig): Record<string, string> {
  const errors: Record<string, string> = {};
  switch (kind) {
    case 'sensor':
      if (!Number.isFinite(toNumber(c.min))) errors.min = 'Enter a number.';
      if (!Number.isFinite(toNumber(c.max))) errors.max = 'Enter a number.';
      else if (toNumber(c.max) <= toNumber(c.min)) errors.max = 'Must be greater than the minimum.';
      break;
    case 'logic':
      if (!Number.isFinite(toNumber(c.threshold))) errors.threshold = 'Enter a number.';
      break;
    case 'mqtt':
      if (!/^[^\s:]+:\d{1,5}$/.test(String(c.broker))) errors.broker = 'Use host:port, for example localhost:1883.';
      if (!String(c.topic).trim()) errors.topic = 'A topic is required.';
      break;
    case 'cloudApi':
      if (!/^https?:\/\/\S+$/i.test(String(c.url))) errors.url = 'Enter a full http(s) URL.';
      break;
    case 'docker':
      if (!String(c.image).trim()) errors.image = 'An image name is required.';
      if (!(toNumber(c.port) >= 1 && toNumber(c.port) <= 65535)) errors.port = 'Port must be between 1 and 65535.';
      break;
    case 'kubernetes':
      if (!DNS_LABEL.test(String(c.deploymentName))) errors.deploymentName = 'Use lowercase letters, digits and dashes.';
      if (!DNS_LABEL.test(String(c.namespace))) errors.namespace = 'Use lowercase letters, digits and dashes.';
      if (!(toNumber(c.replicas) >= 1)) errors.replicas = 'At least 1 replica is required.';
      break;
  }
  return errors;
}

/** Workflow-level validation: structure and configuration problems. */
export function validateWorkflow(nodes: NexaNode[], edges: NexaEdge[]): WorkflowIssue[] {
  if (nodes.length === 0) return [];
  const issues: WorkflowIssue[] = [];

  if (!nodes.some((n) => n.data.kind === 'sensor')) {
    issues.push({ level: 'warning', message: 'No data source. Add a Virtual Sensor to run the simulation.' });
  }
  for (const n of nodes) {
    const { kind, label, config } = n.data;
    for (const [key, message] of Object.entries(validateConfig(kind, config))) {
      const field = BLOCKS[kind].fields.find((f) => f.key === key)?.label ?? key;
      issues.push({ level: 'error', message: `${label} · ${field}: ${message}`, nodeId: n.id });
    }
    const hasIn = edges.some((e) => e.target === n.id);
    const hasOut = edges.some((e) => e.source === n.id);
    if (kind === 'sensor' && !hasOut) issues.push({ level: 'warning', message: `${label} has no outgoing connection.`, nodeId: n.id });
    if (kind !== 'sensor' && !hasIn) issues.push({ level: 'warning', message: `${label} has no incoming connection.`, nodeId: n.id });
  }
  return issues;
}
