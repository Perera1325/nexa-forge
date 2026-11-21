import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogEntry, NexaEdge, NexaNode, NodeRuntime } from '../types';
import { runTick } from './engine';

const TICK_MS = 1000;
const HISTORY_LENGTH = 40;
const MAX_LOGS = 80;

type LogInput = Pick<LogEntry, 'level' | 'source' | 'message'>;

export function useSimulation(nodes: NexaNode[], edges: NexaEdge[]) {
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [runtime, setRuntime] = useState<Record<string, NodeRuntime>>({});
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const graphRef = useRef({ nodes, edges });
  const tickRef = useRef(0);
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

  const step = useCallback(() => {
    tickRef.current += 1;
    const result = runTick(graphRef.current.nodes, graphRef.current.edges, tickRef.current);
    setTick(tickRef.current);
    setRuntime(result.runtime);
    setHistory((prev) => {
      const next = { ...prev };
      for (const [id, value] of Object.entries(result.readings)) {
        next[id] = [...(next[id] ?? []), value].slice(-HISTORY_LENGTH);
      }
      return next;
    });
    pushLogs(result.messages);
  }, [pushLogs]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(step, TICK_MS);
    return () => clearInterval(timer);
  }, [running, step]);

  const start = useCallback(() => {
    if (running) return;
    pushLogs([{ level: 'info', source: 'Simulation', message: 'Started' }]);
    step();
    setRunning(true);
  }, [running, step, pushLogs]);

  const stop = useCallback(() => {
    setRunning(false);
    setRuntime({});
    pushLogs([{ level: 'info', source: 'Simulation', message: 'Stopped' }]);
  }, [pushLogs]);

  const reset = useCallback(() => {
    tickRef.current = 0;
    setTick(0);
    setHistory({});
    setLogs([]);
  }, []);

  return { running, tick, runtime, history, logs, start, stop, reset };
}
