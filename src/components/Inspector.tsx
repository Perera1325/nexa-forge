import { BLOCKS } from '../blocks';
import { validateConfig } from '../lib/workflow';
import type { ConfigValue, NexaEdge, NexaNode } from '../types';
import { BlockIcon, SlidersIcon, TrashIcon } from './icons';

interface Props {
  node: NexaNode | undefined;
  nodes: NexaNode[];
  edges: NexaEdge[];
  onLabel: (id: string, label: string) => void;
  onConfig: (id: string, key: string, value: ConfigValue) => void;
  onDelete: (id: string) => void;
}

export function Inspector({ node, nodes, edges, onLabel, onConfig, onDelete }: Props) {
  if (!node) {
    return (
      <section className="section rail__main" aria-labelledby="inspector-title">
        <div className="section__head">
          <h2 id="inspector-title">Inspector</h2>
        </div>
        <div className="empty">
          <SlidersIcon size={20} />
          <p className="empty__title">No block selected</p>
          <p className="empty__text">Select a block on the canvas to edit its configuration.</p>
        </div>
      </section>
    );
  }

  const def = BLOCKS[node.data.kind];
  const errors = validateConfig(node.data.kind, node.data.config);
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id;
  const inputs = edges.filter((e) => e.target === node.id).map((e) => labelOf(e.source));
  const outputs = edges.filter((e) => e.source === node.id).map((e) => labelOf(e.target));

  return (
    <section className="section rail__main" aria-labelledby="inspector-title">
      <div className="section__head">
        <h2 id="inspector-title">Inspector</h2>
      </div>

      <div className="insp-block">
        <span className="nx-node__icon">
          <BlockIcon kind={node.data.kind} />
        </span>
        <div>
          <div className="insp-block__title">{def.title}</div>
          <div className="insp-block__desc">{def.description}</div>
        </div>
      </div>

      <form className="form" onSubmit={(e) => e.preventDefault()} noValidate>
        <fieldset>
          <legend>General</legend>
          <div className="field">
            <label htmlFor={`${node.id}-label`}>Name</label>
            <input id={`${node.id}-label`} value={node.data.label} onChange={(e) => onLabel(node.id, e.target.value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Configuration</legend>
          {def.fields.map((field) => {
            const id = `${node.id}-${field.key}`;
            const value = node.data.config[field.key] ?? '';
            const error = errors[field.key];
            const describedBy = error ? `${id}-error` : field.hint ? `${id}-hint` : undefined;
            return (
              <div className="field" key={field.key}>
                <label htmlFor={id}>{field.label}</label>
                {field.type === 'select' ? (
                  <select id={id} value={String(value)} onChange={(e) => onConfig(node.id, field.key, e.target.value)} aria-describedby={describedBy}>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type={field.type === 'number' ? 'number' : 'text'}
                    step={field.type === 'number' ? 'any' : undefined}
                    value={value}
                    placeholder={field.placeholder}
                    spellCheck={false}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    onChange={(e) =>
                      onConfig(
                        node.id,
                        field.key,
                        field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
                      )
                    }
                  />
                )}
                {error ? (
                  <p className="field__error" id={`${id}-error`} role="alert">
                    {error}
                  </p>
                ) : (
                  field.hint && (
                    <p className="field__hint" id={`${id}-hint`}>
                      {field.hint}
                    </p>
                  )
                )}
              </div>
            );
          })}
        </fieldset>
      </form>

      <div className="conn">
        <h3>Connections</h3>
        <dl>
          <div>
            <dt>Receives from</dt>
            <dd>{inputs.length ? inputs.join(', ') : 'None'}</dd>
          </div>
          <div>
            <dt>Sends to</dt>
            <dd>{outputs.length ? outputs.join(', ') : 'None'}</dd>
          </div>
        </dl>
      </div>

      <button className="btn btn-danger" onClick={() => onDelete(node.id)} title="Delete this block and its connections (Delete key)">
        <TrashIcon /> Delete block
      </button>
    </section>
  );
}
