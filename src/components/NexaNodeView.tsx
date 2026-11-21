import { useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BLOCKS } from '../blocks';
import { RuntimeContext } from '../simulation/RuntimeContext';
import type { NexaNode } from '../types';
import { BlockIcon } from './icons';

type State = 'off' | 'live' | 'alert' | 'idle';

export function NexaNodeView({ id, data, selected }: NodeProps<NexaNode>) {
  const def = BLOCKS[data.kind];
  const rt = useContext(RuntimeContext)[id];

  let state: State = 'off';
  let live: string | null = null;
  if (rt) {
    if (data.kind === 'logic') {
      state = rt.passed ? 'alert' : 'idle';
      live = rt.passed ? 'Condition met' : 'Condition not met';
    } else if (data.kind === 'sensor') {
      state = 'live';
      live = `${rt.value} ${data.config.unit}`;
    } else {
      state = 'live';
      live = 'Receiving data';
    }
  }

  return (
    <div className={`nx-node ${selected ? 'is-selected' : ''}`}>
      {def.hasInput && <Handle type="target" position={Position.Left} />}
      <div className="nx-node__head">
        <span className="nx-node__icon">
          <BlockIcon kind={data.kind} />
        </span>
        <div className="nx-node__titles">
          <div className="nx-node__title" title={data.label}>
            {data.label}
          </div>
          <div className="nx-node__meta">
            {def.category} · {def.title}
          </div>
        </div>
      </div>
      <dl className="nx-node__rows">
        {def.rows(data.config).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd title={value}>{value}</dd>
          </div>
        ))}
      </dl>
      {live && (
        <div className={`nx-node__live nx-node__live--${state}`}>
          <span className={`status-dot status-dot--${state}`} aria-hidden="true" />
          {live}
        </div>
      )}
      {def.hasOutput && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
