import { describe, expect, it } from 'vitest';
import type { ExecutionEvent } from '../engine';
import { toLogInput, toLogInputs } from './presenter';

const ev = (level: ExecutionEvent['level'], message = 'm'): ExecutionEvent => ({ kind: 'issue', level, source: 'S', message, tick: 1 });

describe('toLogInput', () => {
  it('hides debug events', () => {
    expect(toLogInput(ev('debug'))).toBeNull();
  });

  it('keeps info, event and warn levels as they are', () => {
    expect(toLogInput(ev('info'))).toEqual({ level: 'info', source: 'S', message: 'm' });
    expect(toLogInput(ev('event'))).toEqual({ level: 'event', source: 'S', message: 'm' });
    expect(toLogInput(ev('warn'))).toEqual({ level: 'warn', source: 'S', message: 'm' });
  });

  it('shows errors in the existing log styles with an Error prefix', () => {
    expect(toLogInput(ev('error', 'bad'))).toEqual({ level: 'warn', source: 'S', message: 'Error: bad' });
  });

  it('filters a batch', () => {
    expect(toLogInputs([ev('debug'), ev('info'), ev('error')])).toHaveLength(2);
  });
});
