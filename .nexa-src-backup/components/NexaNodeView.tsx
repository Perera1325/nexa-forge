import { useContext, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BLOCKS } from '../blocks';
import { RuntimeContext } from '../simulation/RuntimeContext';
import type { NexaNode, NexaNodeData, NodeRuntime } from '../types';

function liveText(data: NexaNodeData, rt: NodeRuntime | undefined): string | null {
  if (!rt) return null;
  if (data.kind === 'sensor') return `${rt.value} ${data.config.unit}`;
  if (data.kind === 'logic') return rt.passed ? 'TRIGGERED' : 'CLEAR';
  return 'ACTIVE';
}

export function NexaNodeView({ id, data, selected }: NodeProps<NexaNode>) {
  const def = BLOCKS[data.kind];
  const rt = useContext(RuntimeContext)[id];
  const live = liveText(data, rt);
  const className = ['nx-node', selected ? 'is-selected' : '', rt?.active ? 'is-active' : ''].join(' ');

  return (
    <div className={className} style={{ '--accent': def.accent } as CSSProperties}>
      {def.hasInput && <Handle type="target" position={Position.Left} />}
      <div className="nx-node__head">
        <span className="nx-badge">{def.code}</span>
        <div>
          <div className="nx-node__title">{data.label}</div>
          <div className="nx-node__kind">{def.title}</div>
        </div>
      </div>
      <div className="nx-node__summary">{def.summary(data.config)}</div>
      {live && <div className={`nx-node__live ${rt?.passed ? 'is-alert' : ''}`}>{live}</div>}
      {def.hasOutput && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
