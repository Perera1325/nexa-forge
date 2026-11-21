import type { LogEntry } from '../types';

export function EventLog({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  return (
    <section className="panel bottom-panel">
      <h3>
        Event Log
        <button className="btn btn-ghost btn-sm" onClick={onClear}>
          Clear
        </button>
      </h3>
      <div className="log">
        {logs.length === 0 && <p className="muted">No events yet. Run the simulation to see data flow through your workflow.</p>}
        {logs.map((l) => (
          <div key={l.id} className={`log__row log__row--${l.level}`}>
            <span className="log__time">{l.time}</span>
            <span>{l.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HealthCheck({ issues }: { issues: string[] }) {
  return (
    <section className="panel bottom-panel">
      <h3>Workflow Check</h3>
      <div className="log">
        {issues.length === 0 ? (
          <p className="ok">✓ All blocks are connected. Ready to simulate and generate.</p>
        ) : (
          issues.map((issue) => (
            <div key={issue} className="log__row log__row--warn">
              <span>⚠</span>
              <span>{issue}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
