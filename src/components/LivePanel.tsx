import { BLOCKS } from '../blocks';
import type { NexaNode } from '../types';

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 260;
  const h = 44;
  if (values.length < 2) return <svg className="spark" viewBox={`0 0 ${w} ${h}`} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
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
  return (
    <section className="panel">
      <h3>
        Live Sensors <span className={`dot ${running ? 'on' : ''}`} />
      </h3>
      {sensors.length === 0 && <p className="muted">No Virtual Sensor blocks on the canvas.</p>}
      {sensors.map((n) => {
        const values = history[n.id] ?? [];
        const latest = values[values.length - 1];
        return (
          <div className="sensor-card" key={n.id}>
            <div className="sensor-card__row">
              <span>{n.data.label}</span>
              <strong>{latest === undefined ? '--' : `${latest} ${n.data.config.unit}`}</strong>
            </div>
            <Sparkline values={values} color={BLOCKS.sensor.accent} />
          </div>
        );
      })}
      {!running && sensors.length > 0 && <p className="muted">Press “Run Simulation” to stream mock data.</p>}
    </section>
  );
}
