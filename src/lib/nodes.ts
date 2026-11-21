import { BLOCKS } from '../blocks';
import type { BlockKind, NexaEdge, NexaNode } from '../types';

let counter = 0;

export function createId(kind: BlockKind): string {
  counter += 1;
  return `${kind}-${Date.now().toString(36)}-${counter}`;
}

export function createNode(kind: BlockKind, position: { x: number; y: number }, id?: string): NexaNode {
  const def = BLOCKS[kind];
  return {
    id: id ?? createId(kind),
    type: 'nexa',
    position,
    data: { kind, label: def.title, config: { ...def.defaults } },
  };
}

function link(source: string, target: string): NexaEdge {
  return { id: `e-${source}-${target}`, source, target };
}

/** Example pipeline: acquire and filter data (row 1), then deliver and deploy it (row 2). */
export function createDemoWorkflow(): { nodes: NexaNode[]; edges: NexaEdge[] } {
  const nodes = [
    createNode('sensor', { x: 0, y: 0 }, 'demo-sensor'),
    createNode('logic', { x: 300, y: 0 }, 'demo-logic'),
    createNode('mqtt', { x: 600, y: 0 }, 'demo-mqtt'),
    createNode('cloudApi', { x: 0, y: 250 }, 'demo-api'),
    createNode('docker', { x: 300, y: 250 }, 'demo-docker'),
    createNode('kubernetes', { x: 600, y: 250 }, 'demo-k8s'),
  ];
  nodes[0].data.label = 'Boiler Temperature';
  nodes[1].data.label = 'Overheat Rule';
  const edges = [
    link('demo-sensor', 'demo-logic'),
    link('demo-logic', 'demo-mqtt'),
    link('demo-mqtt', 'demo-api'),
    link('demo-api', 'demo-docker'),
    link('demo-docker', 'demo-k8s'),
  ];
  return { nodes, edges };
}
