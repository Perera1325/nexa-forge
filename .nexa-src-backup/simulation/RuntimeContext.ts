import { createContext } from 'react';
import type { NodeRuntime } from '../types';

export const RuntimeContext = createContext<Record<string, NodeRuntime>>({});
