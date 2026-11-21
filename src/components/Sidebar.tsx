import { useState, type DragEvent, type KeyboardEvent } from 'react';
import { BLOCKS, BLOCK_ORDER, CATEGORIES, DRAG_MIME } from '../blocks';
import type { BlockKind } from '../types';
import { BlockIcon, CloseIcon, SearchIcon } from './icons';

interface Props {
  onAdd: (kind: BlockKind) => void;
  onClose: () => void;
}

export function Sidebar({ onAdd, onClose }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = BLOCK_ORDER.filter((kind) => {
    const def = BLOCKS[kind];
    return !q || `${def.title} ${def.description} ${def.category}`.toLowerCase().includes(q);
  });

  const onDragStart = (event: DragEvent<HTMLDivElement>, kind: BlockKind) => {
    event.dataTransfer.setData(DRAG_MIME, kind);
    event.dataTransfer.effectAllowed = 'move';
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, kind: BlockKind) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onAdd(kind);
    }
  };

  return (
    <div className="palette">
      <div className="section section--head">
        <div className="section__head">
          <h2>Blocks</h2>
          <button className="btn btn-icon btn-quiet only-narrow" onClick={onClose} aria-label="Close block palette" title="Close">
            <CloseIcon />
          </button>
        </div>
        <label className="search">
          <SearchIcon />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter blocks" aria-label="Filter blocks" />
        </label>
      </div>

      <div className="palette__list">
        {visible.length === 0 && (
          <div className="empty">
            <p className="empty__title">No matching blocks</p>
            <p className="empty__text">Try a different term, such as “sensor” or “deploy”.</p>
          </div>
        )}
        {CATEGORIES.map((category) => {
          const kinds = visible.filter((k) => BLOCKS[k].category === category);
          if (kinds.length === 0) return null;
          return (
            <section key={category} className="palette__group" aria-label={category}>
              <h3 className="palette__category">{category}</h3>
              {kinds.map((kind) => {
                const def = BLOCKS[kind];
                return (
                  <div
                    key={kind}
                    className="palette-item"
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => onDragStart(e, kind)}
                    onClick={() => onAdd(kind)}
                    onKeyDown={(e) => onKeyDown(e, kind)}
                    aria-label={`Add ${def.title} block`}
                    title={`${def.description}\nDrag onto the canvas, or press Enter to add.`}
                  >
                    <span className="nx-node__icon">
                      <BlockIcon kind={kind} />
                    </span>
                    <span className="palette-item__text">
                      <span className="palette-item__title">{def.title}</span>
                      <span className="palette-item__desc">{def.description}</span>
                    </span>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <p className="palette__foot">Drag a block onto the canvas, or focus it and press Enter.</p>
    </div>
  );
}
