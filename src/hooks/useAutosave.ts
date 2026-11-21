import { useCallback, useEffect, useRef, useState } from 'react';
import { saveProject } from '../lib/storage';
import type { NexaEdge, NexaNode } from '../types';

export type SaveStatus = 'saved' | 'saving' | 'error';

/** Debounced autosave of the project to browser storage. `saveNow` flushes immediately. */
export function useAutosave(name: string, nodes: NexaNode[], edges: NexaEdge[], delayMs = 600) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef({ name, nodes, edges });
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef(false);
  const mounted = useRef(false);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    pending.current = false;
    const result = saveProject(latest.current.name, latest.current.nodes, latest.current.edges);
    setStatus(result.ok ? 'saved' : 'error');
    setError(result.ok ? null : result.error);
    return result;
  }, []);

  useEffect(() => {
    latest.current = { name, nodes, edges };
    if (!mounted.current) {
      mounted.current = true; // the initial state is already what is stored (or the starting example)
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
