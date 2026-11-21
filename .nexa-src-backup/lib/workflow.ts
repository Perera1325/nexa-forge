import type { BlockKind, NexaEdge, NexaNode, NodeConfig } from '../types';

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

/** Returns human-readable problems; an empty list means the workflow looks sound. */
export function validateWorkflow(nodes: NexaNode[], edges: NexaEdge[]): string[] {
  const issues: string[] = [];
  if (nodes.length === 0) return ['The canvas is empty. Drag a block from the palette to start.'];
  if (!nodes.some((n) => n.data.kind === 'sensor')) issues.push('Add at least one Virtual Sensor as a data source.');
  for (const n of nodes) {
    const hasIn = edges.some((e) => e.target === n.id);
    const hasOut = edges.some((e) => e.source === n.id);
    if (n.data.kind === 'sensor' && !hasOut) issues.push(`"${n.data.label}" has no outgoing connection.`);
    if (n.data.kind !== 'sensor' && !hasIn) issues.push(`"${n.data.label}" has no incoming connection.`);
  }
  return issues;
}
