import type { LogEntry, WorkflowIssue } from '../types';
import { CheckIcon } from './icons';

export type DockTab = 'log' | 'check';

interface Props {
  tab: DockTab;
  onTab: (tab: DockTab) => void;
  logs: LogEntry[];
  issues: WorkflowIssue[];
  nodeCount: number;
  onClear: () => void;
  onFocusNode: (id: string) => void;
}

export function Dock({ tab, onTab, logs, issues, nodeCount, onClear, onFocusNode }: Props) {
  const errors = issues.filter((i) => i.level === 'error').length;
  return (
    <footer className="dock" aria-label="Diagnostics">
      <div className="dock__bar">
        <div role="tablist" aria-label="Diagnostics panels" className="tabs">
          <button role="tab" id="tab-log" aria-selected={tab === 'log'} aria-controls="panel-log" className="tab" onClick={() => onTab('log')}>
            Event log
          </button>
          <button role="tab" id="tab-check" aria-selected={tab === 'check'} aria-controls="panel-check" className="tab" onClick={() => onTab('check')}>
            Workflow check
            {issues.length > 0 && (
              <span className={`badge ${errors > 0 ? 'badge--error' : 'badge--warn'}`} aria-label={`${issues.length} issues`}>
                {issues.length}
              </span>
            )}
          </button>
        </div>
        {tab === 'log' && (
          <button className="btn btn-sm btn-quiet" onClick={onClear} disabled={logs.length === 0} title="Clear the event log and reset sensor history">
            Clear
          </button>
        )}
      </div>

      {tab === 'log' ? (
        <div role="tabpanel" id="panel-log" aria-labelledby="tab-log" className="dock__body">
          {logs.length === 0 ? (
            <div className="empty">
              <p className="empty__title">No events yet</p>
              <p className="empty__text">Run the simulation to see readings, rule triggers and outbound messages as they happen.</p>
            </div>
          ) : (
            <div role="log" aria-live="off" aria-label="Simulation events">
              {logs.map((l) => (
                <div key={l.id} className="log-row">
                  <span className="log-row__time">{l.time}</span>
                  <span className={`log-row__level log-row__level--${l.level}`}>
                    <span className="sr-only">{l.level === 'warn' ? 'Rule triggered' : l.level === 'event' ? 'Output' : 'System'}</span>
                  </span>
                  <span className="log-row__source" title={l.source}>
                    {l.source}
                  </span>
                  <span className="log-row__msg">{l.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" id="panel-check" aria-labelledby="tab-check" className="dock__body">
          {nodeCount === 0 ? (
            <div className="empty">
              <p className="empty__title">Nothing to check yet</p>
              <p className="empty__text">Add blocks to the canvas and the workflow is validated as you build.</p>
            </div>
          ) : issues.length === 0 ? (
            <div className="check-ok">
              <CheckIcon />
              <span>No issues found. Blocks are connected and configuration is valid.</span>
            </div>
          ) : (
            <ul className="issues">
              {issues.map((issue, i) => {
                const content = (
                  <>
                    <span className={`issue__level issue__level--${issue.level}`}>{issue.level === 'error' ? 'Error' : 'Warning'}</span>
                    <span className="issue__msg">{issue.message}</span>
                    {issue.nodeId && <span className="issue__action">Show block</span>}
                  </>
                );
                return (
                  <li key={`${issue.message}-${i}`}>
                    {issue.nodeId ? (
                      <button className="issue" onClick={() => onFocusNode(issue.nodeId as string)}>
                        {content}
                      </button>
                    ) : (
                      <div className="issue issue--static">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </footer>
  );
}
