import { BLOCKS } from '../blocks';
import type { ConfigValue, NexaNode } from '../types';

interface Props {
  node: NexaNode | undefined;
  onLabel: (id: string, label: string) => void;
  onConfig: (id: string, key: string, value: ConfigValue) => void;
  onDelete: (id: string) => void;
}

export function Inspector({ node, onLabel, onConfig, onDelete }: Props) {
  if (!node) {
    return (
      <section className="panel">
        <h3>Inspector</h3>
        <p className="muted">Select a block to edit its settings.</p>
      </section>
    );
  }
  const def = BLOCKS[node.data.kind];
  return (
    <section className="panel">
      <h3>
        Inspector <span className="muted">· {def.title}</span>
      </h3>
      <label className="field">
        <span>Label</span>
        <input value={node.data.label} onChange={(e) => onLabel(node.id, e.target.value)} />
      </label>
      {def.fields.map((field) => {
        const value = node.data.config[field.key] ?? '';
        return (
          <label className="field" key={field.key}>
            <span>{field.label}</span>
            {field.type === 'select' ? (
              <select value={String(value)} onChange={(e) => onConfig(node.id, field.key, e.target.value)}>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={value}
                onChange={(e) =>
                  onConfig(
                    node.id,
                    field.key,
                    field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
                  )
                }
              />
            )}
          </label>
        );
      })}
      <button className="btn btn-danger" onClick={() => onDelete(node.id)}>
        Delete block
      </button>
    </section>
  );
}
