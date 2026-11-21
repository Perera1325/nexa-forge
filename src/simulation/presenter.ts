import type { ExecutionEvent } from '../engine';
import type { LogEntry } from '../types';

export type LogInput = Pick<LogEntry, 'level' | 'source' | 'message'>;

/**
 * Turns an engine event into an Event Log row. Debug events are not shown.
 * The log has three levels, so errors are shown at the "warn" level with an "Error:" prefix.
 */
export function toLogInput(event: ExecutionEvent): LogInput | null {
  switch (event.level) {
    case 'debug':
      return null;
    case 'error':
      return { level: 'warn', source: event.source, message: `Error: ${event.message}` };
    default:
      return { level: event.level, source: event.source, message: event.message };
  }
}

export const toLogInputs = (events: ExecutionEvent[]): LogInput[] => events.map(toLogInput).filter((row): row is LogInput => row !== null);
