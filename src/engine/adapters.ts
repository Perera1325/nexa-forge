import type { NodeConfig } from '../types';
import type { Signal } from './types';

/**
 * Adapters are the only place where a block touches "the outside world".
 * Everything in this file is simulated: nothing opens a network connection, starts a container or talks to a cluster.
 * A real implementation would have to be written, configured and injected explicitly; the engine never creates one itself.
 */

export interface PublishRecord {
  topic: string;
  payload: string;
  qos: number;
  broker: string;
  simulated: boolean;
}

export interface RequestRecord {
  method: string;
  url: string;
  body: string;
  simulated: boolean;
}

export interface PreparationRecord {
  summary: string;
  simulated: boolean;
}

export interface Adapters {
  sensor: { read(config: NodeConfig, tick: number): number };
  mqtt: { publish(config: NodeConfig, signal: Signal): PublishRecord };
  api: { request(config: NodeConfig, signal: Signal): RequestRecord };
  docker: { prepare(config: NodeConfig): PreparationRecord };
  kubernetes: { prepare(config: NodeConfig): PreparationRecord };
}

/** Mock sensor data: sine wave with noise, uniform random, or a repeating ramp. */
export function generateReading(config: NodeConfig, tick: number, random: () => number = Math.random): number {
  const min = Number(config.min);
  const max = Number(config.max);
  if (!(max > min)) return Number.isFinite(min) ? min : 0;
  const mid = (min + max) / 2;
  const amp = (max - min) / 2;
  let value: number;
  switch (config.pattern) {
    case 'random':
      value = min + random() * (max - min);
      break;
    case 'ramp':
      value = min + ((tick * (max - min)) / 30) % (max - min);
      break;
    default:
      value = mid + amp * 0.8 * Math.sin(tick / 6) + (random() - 0.5) * amp * 0.2;
  }
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

/** The default adapters: mock readings, and records of what *would* be sent or deployed. */
export function createSimulatedAdapters(random: () => number = Math.random): Adapters {
  return {
    sensor: { read: (config, tick) => generateReading(config, tick, random) },
    mqtt: {
      publish: (config, signal) => ({
        topic: String(config.topic),
        payload: JSON.stringify({ value: signal.value }),
        qos: Number(config.qos) || 0,
        broker: String(config.broker),
        simulated: true,
      }),
    },
    api: {
      request: (config, signal) => ({
        method: String(config.method),
        url: String(config.url),
        body: JSON.stringify({ value: signal.value }),
        simulated: true,
      }),
    },
    docker: {
      prepare: (config) => ({
        summary: `Prepared image ${String(config.image)} (container port ${String(config.port)})`,
        simulated: true,
      }),
    },
    kubernetes: {
      prepare: (config) => ({
        summary: `Prepared deployment ${String(config.deploymentName)} in namespace ${String(config.namespace)} with ${String(config.replicas)} replica(s)`,
        simulated: true,
      }),
    },
  };
}
