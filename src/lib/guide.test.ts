import { describe, expect, it } from 'vitest';
import { GUIDE_STEPS } from '../guide/steps';
import { dismissGuide, GUIDE_KEY, isGuideDismissed } from './guide';
import type { StoreLike } from './storage';

const store = (): StoreLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

describe('first-workflow guide', () => {
  it('is shown until it is dismissed, and then stays dismissed', () => {
    const s = store();
    expect(isGuideDismissed(s)).toBe(false);
    expect(dismissGuide(s)).toBe(true);
    expect(s.data.get(GUIDE_KEY)).toBe('1');
    expect(isGuideDismissed(s)).toBe(true);
  });

  it('copes with unavailable or failing storage', () => {
    expect(isGuideDismissed(null)).toBe(false);
    expect(dismissGuide(null)).toBe(false);
    const broken: StoreLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(isGuideDismissed(broken)).toBe(false);
    expect(dismissGuide(broken)).toBe(false);
  });

  it('covers every topic the first workflow needs, in order', () => {
    const titles = GUIDE_STEPS.map((s) => s.title.toLowerCase());
    const topics = ['what is a workflow', 'add a block', 'connect', 'configure a sensor', 'configure a logic', 'run the simulation', 'export'];
    topics.forEach((topic, i) => expect(titles[i]).toContain(topic));
    for (const s of GUIDE_STEPS) {
      expect(s.body.length).toBeGreaterThan(20);
      expect(s.tryIt.length).toBeGreaterThan(20);
    }
  });
});
