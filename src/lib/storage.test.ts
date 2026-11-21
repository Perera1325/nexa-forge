import { describe, expect, it } from 'vitest';
import { createDemoWorkflow } from './nodes';
import { CORRUPT_KEY, loadProject, saveProject, STORAGE_KEY, type StoreLike } from './storage';

function memoryStore(initial: Record<string, string> = {}): StoreLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('project persistence', () => {
  it('reports an empty store', () => {
    expect(loadProject(memoryStore())).toEqual({ status: 'empty' });
  });

  it('saves and restores a project', () => {
    const store = memoryStore();
    const { nodes, edges } = createDemoWorkflow();
    expect(saveProject('Saved one', nodes, edges, store)).toEqual({ ok: true });
    const loaded = loadProject(store);
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.name).toBe('Saved one');
    expect(loaded.nodes).toHaveLength(6);
    expect(loaded.edges).toHaveLength(5);
  });

  it('does not store selection state', () => {
    const store = memoryStore();
    const { nodes, edges } = createDemoWorkflow();
    saveProject('x', [{ ...nodes[0], selected: true }, ...nodes.slice(1)], edges, store);
    expect(store.data[STORAGE_KEY]).not.toContain('selected');
  });

  it('keeps a copy of corrupted data and reports it', () => {
    const store = memoryStore({ [STORAGE_KEY]: '{"broken":' });
    const loaded = loadProject(store);
    expect(loaded.status).toBe('corrupt');
    expect(store.data[CORRUPT_KEY]).toBe('{"broken":');
  });

  it('treats a wrong-schema value as corrupt', () => {
    expect(loadProject(memoryStore({ [STORAGE_KEY]: '{"hello":1}' })).status).toBe('corrupt');
  });

  it('handles unavailable storage', () => {
    expect(loadProject(null).status).toBe('unavailable');
    const { nodes, edges } = createDemoWorkflow();
    expect(saveProject('x', nodes, edges, null)).toMatchObject({ ok: false });
  });

  it('handles storage that throws (quota exceeded, blocked)', () => {
    const broken: StoreLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };
    expect(loadProject(broken)).toEqual({ status: 'unavailable', error: 'blocked' });
    const { nodes, edges } = createDemoWorkflow();
    expect(saveProject('x', nodes, edges, broken)).toEqual({ ok: false, error: 'quota exceeded' });
  });
});
