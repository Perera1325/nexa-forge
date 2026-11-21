import { describe, expect, it } from 'vitest';
import { createDemoWorkflow, createNode } from '../lib/nodes';
import type { NexaEdge } from '../types';
import { compare, generateReading, runTick } from './engine';

describe('generateReading', () => {
  it('stays within the configured range for every pattern', () => {
    for (const pattern of ['sine', 'random', 'ramp']) {
      for (let tick = 0; tick < 200; tick++) {
        const v = generateReading({ min: 10, max: 20, pattern }, tick);
        expect(v).toBeGreaterThanOrEqual(10);
        expect(v).toBeLessThanOrEqual(20);
      }
    }
  });

  it('is safe for an invalid range', () => {
    expect(generateReading({ min: 5, max: 5 }, 1)).toBe(5);
    expect(generateReading({ min: 9, max: 1 }, 1)).toBe(9);
    expect(generateReading({ min: '', max: 'x' }, 1)).toBe(0);
  });
});

describe('compare', () => {
  it('implements every operator and rejects unknown ones', () => {
    expect(compare(5, '>', 4)).toBe(true);
    expect(compare(5, '<', 4)).toBe(false);
    expect(compare(5, '>=', 5)).toBe(true);
    expect(compare(5, '<=', 4)).toBe(false);
    expect(compare(5, '==', 5)).toBe(true);
    expect(compare(5, '!=', 5)).toBe(false);
  });
});

describe('runTick', () => {
  const setup = (threshold: number) => {
    const { nodes, edges } = createDemoWorkflow();
    nodes[0].data.config = { ...nodes[0].data.config, min: 50, max: 50, pattern: 'random' }; // constant 50
    nodes[1].data.config = { operator: '>', threshold };
    return { nodes, edges };
  };

  it('propagates data through the whole chain when the condition is met', () => {
    const { nodes, edges } = setup(10);
    const result = runTick(nodes, edges, 1);
    expect(Object.keys(result.runtime)).toHaveLength(6);
    expect(result.runtime['demo-logic'].passed).toBe(true);
    expect(result.readings['demo-sensor']).toBe(50);
    const sources = result.messages.map((m) => m.source);
    expect(sources).toContain('Overheat Rule');
    expect(result.messages.some((m) => m.message.startsWith('PUBLISH nexa/factory/telemetry'))).toBe(true);
    expect(result.messages.some((m) => m.message.startsWith('POST https://'))).toBe(true);
  });

  it('stops downstream blocks when a Logic condition is not met', () => {
    const { nodes, edges } = setup(99);
    const result = runTick(nodes, edges, 1);
    expect(result.runtime['demo-logic'].passed).toBe(false);
    expect(result.runtime['demo-mqtt']).toBeUndefined();
    expect(result.messages).toEqual([]);
  });

  it('does nothing without a sensor', () => {
    const only = [createNode('mqtt', { x: 0, y: 0 }, 'm')];
    expect(runTick(only, [], 1)).toEqual({ runtime: {}, readings: {}, messages: [] });
  });

  it('survives a cycle without looping forever', () => {
    const { nodes, edges } = setup(10);
    const back: NexaEdge = { id: 'loop', source: 'demo-mqtt', target: 'demo-logic' };
    expect(() => runTick(nodes, [...edges, back], 1)).not.toThrow();
  });
});
