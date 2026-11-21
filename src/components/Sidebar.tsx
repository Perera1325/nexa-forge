import type { DragEvent } from 'react';
import { BLOCKS, BLOCK_ORDER, DRAG_MIME } from '../blocks';
import type { BlockKind } from '../types';

interface Props {
  onAdd: (kind: BlockKind) => void;
}

export function Sidebar({ onAdd }: Props) {
  const groups = [...new Set(BLOCK_ORDER.map((k) => BLOCKS[k].group))];

  const onDragStart = (event: DragEvent<HTMLDivElement>, kind: BlockKind) => {
    event.dataTransfer.setData(DRAG_MIME, kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      <h3>Block Palette</h3>
      <p className="muted">Drag onto the canvas, or click to add.</p>
      {groups.map((group) => (
        <div key={group} className="palette-group">
          <h4>{group}</h4>
          {BLOCK_ORDER.filter((k) => BLOCKS[k].group === group).map((kind) => {
            const def = BLOCKS[kind];
            return (
              <div
                key={kind}
                className="palette-item"
                draggable
                onDragStart={(e) => onDragStart(e, kind)}
                onClick={() => onAdd(kind)}
                style={{ '--accent': def.accent } as React.CSSProperties}
              >
                <span className="nx-badge">{def.code}</span>
                <div>
                  <div className="palette-item__title">{def.title}</div>
                  <div className="muted">{def.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
