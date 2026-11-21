import type { NexaNode } from '../types';

function Sparkline({ values }: { values: number[] }) {
  const w = 260;
  const h = 36;
  if (values.length < 2) return <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="No readings yet" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Recent readings">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface Props {
  nodes: NexaNode[];
  history: Record<string, number[]>;
  running: boolean;
}

export function LivePanel({ nodes, history, running }: Props) {
  const sensors = nodes.filter((n) => n.data.kind === 'sensor');
  const hasHistory = Object.keys(history).length > 0;
  return (
    <section className="section rail__live" aria-labelledby="live-title">
      <div className="section__head">
        <h2 id="live-title">Live data</h2>
        <span className="live-state">
          <span className={`status-dot status-dot--${running ? 'live' : 'off'}`} aria-hidden="true" />
          {running ? 'Streaming' : 'Idle'}
        </span>
      </div>
      {sensors.length === 0 ? (
        <p className="muted-text">No Virtual Sensor on the canvas.</p>
      ) : (
        sensors.map((n) => {
          const values = history[n.id] ?? [];
          const latest = values[values.length - 1];
          return (
            <div className="reading" key={n.id}>
              <div className="reading__row">
                <span className="reading__name" title={n.data.label}>
                  {n.data.label}
                </span>
                <span className="reading__value">{latest === undefined ? '—' : `${latest} ${n.data.config.unit}`}</span>
              </div>
              <Sparkline values={values} />
            </div>
          );
        })
      )}
      {!running && sensors.length > 0 && !hasHistory && <p className="muted-text">Run the simulation to stream mock readings.</p>}
    </section>
  );
}
