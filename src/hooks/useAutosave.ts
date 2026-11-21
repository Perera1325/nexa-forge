import { useCallback, useEffect, useRef, useState } from 'react';
import { saveProject } from '../lib/storage';
import type { NexaEdge, NexaNode } from '../types';

export type SaveStatus = 'saved' | 'saving' | 'error';

/** What actually gets saved. Selection, zoom and runtime state are ignored so they never trigger a save. */
const signature = (name: string, nodes: NexaNode[], edges: NexaEdge[]) =>
  JSON.stringify([
    name,
    nodes.map((n) => [n.id, n.data.kind, n.data.label, Math.round(n.position.x), Math.round(n.position.y), n.data.config]),
    edges.map((e) => [e.id, e.source, e.target]),
  ]);

/** Debounced autosave of the project to browser storage. `saveNow` flushes immediately. */
export function useAutosave(name: string, nodes: NexaNode[], edges: NexaEdge[], delayMs = 600) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef({ name, nodes, edges });
  const savedSignature = useRef(signature(name, nodes, edges));
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef(false);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    pending.current = false;
    const { name: n, nodes: ns, edges: es } = latest.current;
    const result = saveProject(n, ns, es);
    if (result.ok) savedSignature.current = signature(n, ns, es);
    setStatus(result.ok ? 'saved' : 'error');
    setError(result.ok ? null : result.error);
    return result;
  }, []);

  useEffect(() => {
    latest.current = { name, nodes, edges };
    if (signature(name, nodes, edges) === savedSignature.current) {
      // Nothing to save (for example only the selection changed, or a change was undone).
      pending.current = false;
      setStatus((s) => (s === 'saving' ? 'saved' : s));
      return undefined;
    }
    pending.current = true;
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, delayMs);
    return () => window.clearTimeout(timer.current);
  }, [name, nodes, edges, delayMs, flush]);

  useEffect(() => {
    const onLeave = () => {
      if (pending.current) flush();
    };
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [flush]);

  return { status, error, saveNow: flush };
}
