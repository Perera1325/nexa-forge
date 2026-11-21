import type { NexaEdge, NexaNode } from '../types';
import { buildWorkflow, parseWorkflow } from './workflow';

export const STORAGE_KEY = 'nexa-forge:project';
export const CORRUPT_KEY = `${STORAGE_KEY}:corrupt`;

export type StoreLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; name: string; nodes: NexaNode[]; edges: NexaEdge[] }
  | { status: 'corrupt'; error: string }
  | { status: 'unavailable'; error: string };

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Returns localStorage, or null when the browser blocks it (private mode, policy, quota setup). */
export function getBrowserStorage(): StoreLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Restores the autosaved project. Unreadable data is never discarded silently:
 * a copy is kept under CORRUPT_KEY before the app starts autosaving over it.
 */
export function loadProject(store: StoreLike | null = getBrowserStorage()): LoadResult {
  if (!store) return { status: 'unavailable', error: 'Browser storage is not available.' };
  let text: string | null;
  try {
    text = store.getItem(STORAGE_KEY);
  } catch (error) {
    return { status: 'unavailable', error: error instanceof Error ? error.message : 'Browser storage could not be read.' };
  }
  if (text === null) return { status: 'empty' };
  const parsed = parseWorkflow(text);
  if (parsed.ok) return { status: 'ok', name: parsed.name, nodes: parsed.nodes, edges: parsed.edges };
  try {
    store.setItem(CORRUPT_KEY, text);
  } catch {
    /* best effort */
  }
  return { status: 'corrupt', error: parsed.error };
}

export function saveProject(name: string, nodes: NexaNode[], edges: NexaEdge[], store: StoreLike | null = getBrowserStorage()): SaveResult {
  if (!store) return { ok: false, error: 'Browser storage is not available.' };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(buildWorkflow(name, nodes, edges)));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Saving to browser storage failed.' };
  }
}
