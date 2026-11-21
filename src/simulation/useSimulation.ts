import { useCallback, useEffect, useRef, useState } from 'react';
import { createRunner, type NodeState, type Runner, type TickOutput } from '../engine';
import type { LogEntry, NexaEdge, NexaNode, NodeRuntime } from '../types';
import { toLogInputs, type LogInput } from './presenter';

const TICK_MS = 1000;
const HISTORY_LENGTH = 40;
const MAX_LOGS = 80;

/** React adapter for the execution engine: owns UI state only. All execution logic lives in src/engine. */
export function useSimulation(nodes: NexaNode[], edges: NexaEdge[]) {
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [runtime, setRuntime] = useState<Record<string, NodeRuntime>>({});
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeState>>({});
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const graphRef = useRef({ nodes, edges });
  const runnerRef = useRef<Runner | null>(null);
  const logId = useRef(0);

  useEffect(() => {
    graphRef.current = { nodes, edges };
  }, [nodes, edges]);

  const pushLogs = useCallback((items: LogInput[]) => {
    if (items.length === 0) return;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const entries = items
      .slice()
      .reverse()
      .map((item) => ({ id: ++logId.current, time, ...item }));
    setLogs((prev) => [...entries, ...prev].slice(0, MAX_LOGS));
  }, []);

  const applyTick = useCallback(
    (result: TickOutput) => {
      setTick(result.tick);
      setRuntime(result.runtime);
      setNodeStatus(result.nodes);
      setHistory((prev) => {
        const next = { ...prev };
        for (const [id, value] of Object.entries(result.readings)) {
          next[id] = [...(next[id] ?? []), value].slice(-HISTORY_LENGTH);
        }
        return next;
      });
      pushLogs(toLogInputs(result.events));
    },
    [pushLogs],
  );

  // One runner per mounted hook. Disposing it on unmount guarantees no timer outlives the component.
  useEffect(() => {
    const runner = createRunner({
      getGraph: () => graphRef.current,
      intervalMs: TICK_MS,
      onStart: (out) => {
        setNodeStatus(out.nodes);
        pushLogs(toLogInputs(out.events));
      },
      onTick: applyTick,
      onStop: (out) => {
        setRunning(false);
        setRuntime({});
        setNodeStatus(out.nodes);
        pushLogs(toLogInputs(out.events));
      },
      onError: (error) => {
        setRunning(false);
        setRuntime({});
        pushLogs([{ level: 'warn', source: 'Simulation', message: `Error: the simulation stopped unexpectedly (${error.message}).` }]);
      },
    });
    runnerRef.current = runner;
    return () => {
      runner.dispose();
      runnerRef.current = null;
    };
  }, [applyTick, pushLogs]);

  const start = useCallback(() => {
    if (runnerRef.current?.start()) setRunning(true);
  }, []);

  const stop = useCallback(() => {
    runnerRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    runnerRef.current?.reset();
    setTick(0);
    setHistory({});
    setNodeStatus({});
    setLogs([]);
  }, []);

  return { running, tick, runtime, nodeStatus, history, logs, start, stop, reset };
}
