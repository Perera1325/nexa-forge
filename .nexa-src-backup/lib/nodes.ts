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

/** A ready-made pipeline so the canvas is never empty on first launch. */
export function createDemoWorkflow(): { nodes: NexaNode[]; edges: NexaEdge[] } {
  const nodes = [
    createNode('sensor', { x: 0, y: 120 }, 'demo-sensor'),
    createNode('logic', { x: 230, y: 120 }, 'demo-logic'),
    createNode('mqtt', { x: 460, y: 120 }, 'demo-mqtt'),
    createNode('cloudApi', { x: 690, y: 120 }, 'demo-api'),
    createNode('docker', { x: 920, y: 120 }, 'demo-docker'),
    createNode('kubernetes', { x: 1150, y: 120 }, 'demo-k8s'),
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
