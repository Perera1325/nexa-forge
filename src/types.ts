import type { Edge, Node } from '@xyflow/react';

export type BlockKind = 'sensor' | 'logic' | 'mqtt' | 'cloudApi' | 'docker' | 'kubernetes';
export type ConfigValue = string | number;
export type NodeConfig = Record<string, ConfigValue>;

export interface NexaNodeData extends Record<string, unknown> {
  kind: BlockKind;
  label: string;
  config: NodeConfig;
}

export type NexaNode = Node<NexaNodeData, 'nexa'>;
export type NexaEdge = Edge;

/** Live state of a node while the simulation is running. */
export interface NodeRuntime {
  active: boolean;
  value?: number;
  passed?: boolean;
}

export interface LogEntry {
  id: number;
  time: string;
  level: 'info' | 'event' | 'warn';
  source: string;
  message: string;
}

export interface WorkflowIssue {
  level: 'error' | 'warning';
  message: string;
  nodeId?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}
