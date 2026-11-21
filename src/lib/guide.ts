import type { StoreLike } from './storage';
import { getBrowserStorage } from './storage';

export const GUIDE_KEY = 'nexa-forge:guide-dismissed';

/** Whether the user has already closed the first-workflow guide. If storage is unavailable the answer is false, so the guide is shown. */
export function isGuideDismissed(store: StoreLike | null = getBrowserStorage()): boolean {
  try {
    return store?.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remembers that the guide was closed. Returns false if it could not be stored (the guide then simply shows again next time). */
export function dismissGuide(store: StoreLike | null = getBrowserStorage()): boolean {
  try {
    if (!store) return false;
    store.setItem(GUIDE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}
