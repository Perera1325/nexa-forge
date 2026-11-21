import { BLOCKS } from '../blocks';
import type { BlockKind, ConfigValue, NexaEdge, NexaNode, NodeConfig, WorkflowIssue } from '../types';

export const WORKFLOW_SCHEMA = 'nexa-forge/workflow' as const;
export const WORKFLOW_VERSION = 1 as const;
export const MAX_WORKFLOW_BYTES = 1_000_000;
const MAX_NODES = 500;
const MAX_EDGES = 2000;

export interface WorkflowDocument {
  schema: typeof WORKFLOW_SCHEMA;
  version: typeof WORKFLOW_VERSION;
  name: string;
  exportedAt: string;
  nodes: Array<{
    id: string;
    kind: BlockKind;
    label: string;
    position: { x: number; y: number };
    config: NodeConfig;
  }>;
  edges: Array<{ id: string; source: string; target: string }>;
}

export function buildWorkflow(name: string, nodes: NexaNode[], edges: NexaEdge[]): WorkflowDocument {
  return {
    schema: WORKFLOW_SCHEMA,
    version: WORKFLOW_VERSION,
    name,
    exportedAt: new Date().toISOString(),
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      label: n.data.label,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      config: n.data.config,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const toNumber = (v: ConfigValue | undefined) => (v === undefined || v === '' ? Number.NaN : Number(v));

/** Field-level validation: returns an error message per invalid config key. */
export function validateConfig(kind: BlockKind, c: NodeConfig): Record<string, string> {
  const errors: Record<string, string> = {};
  switch (kind) {
    case 'sensor':
      if (!Number.isFinite(toNumber(c.min))) errors.min = 'Enter a number.';
      if (!Number.isFinite(toNumber(c.max))) errors.max = 'Enter a number.';
      else if (toNumber(c.max) <= toNumber(c.min)) errors.max = 'Must be greater than the minimum.';
      break;
    case 'logic':
      if (!Number.isFinite(toNumber(c.threshold))) errors.threshold = 'Enter a number.';
      break;
    case 'mqtt':
      if (!/^[^\s:]+:\d{1,5}$/.test(String(c.broker))) errors.broker = 'Use host:port, for example localhost:1883.';
      if (!String(c.topic).trim()) errors.topic = 'A topic is required.';
      break;
    case 'cloudApi':
      if (!/^https?:\/\/\S+$/i.test(String(c.url))) errors.url = 'Enter a full http(s) URL.';
      break;
    case 'docker':
      if (!String(c.image).trim()) errors.image = 'An image name is required.';
      if (!(toNumber(c.port) >= 1 && toNumber(c.port) <= 65535)) errors.port = 'Port must be between 1 and 65535.';
      break;
    case 'kubernetes':
      if (!DNS_LABEL.test(String(c.deploymentName))) errors.deploymentName = 'Use lowercase letters, digits and dashes.';
      if (!DNS_LABEL.test(String(c.namespace))) errors.namespace = 'Use lowercase letters, digits and dashes.';
      if (!(toNumber(c.replicas) >= 1)) errors.replicas = 'At least 1 replica is required.';
      break;
  }
  return errors;
}

/** Workflow-level validation: structure and configuration problems. */
export function validateWorkflow(nodes: NexaNode[], edges: NexaEdge[]): WorkflowIssue[] {
  if (nodes.length === 0) return [];
  const issues: WorkflowIssue[] = [];

  if (!nodes.some((n) => n.data.kind === 'sensor')) {
    issues.push({ level: 'warning', message: 'No data source. Add a Virtual Sensor to run the simulation.' });
  }
  for (const n of nodes) {
    const { kind, label, config } = n.data;
    for (const [key, message] of Object.entries(validateConfig(kind, config))) {
      const field = BLOCKS[kind].fields.find((f) => f.key === key)?.label ?? key;
      issues.push({ level: 'error', message: `${label} · ${field}: ${message}`, nodeId: n.id });
    }
    const hasIn = edges.some((e) => e.target === n.id);
    const hasOut = edges.some((e) => e.source === n.id);
    if (kind === 'sensor' && !hasOut) issues.push({ level: 'warning', message: `${label} has no outgoing connection.`, nodeId: n.id });
    if (kind !== 'sensor' && !hasIn) issues.push({ level: 'warning', message: `${label} has no incoming connection.`, nodeId: n.id });
  }
  return issues;
}

// ---------------------------------------------------------------- import

export type ParseResult =
  | { ok: true; name: string; nodes: NexaNode[]; edges: NexaEdge[]; warnings: string[] }
  | { ok: false; error: string };

const fail = (error: string): ParseResult => ({ ok: false, error });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isBlockKind = (v: unknown): v is BlockKind => typeof v === 'string' && Object.hasOwn(BLOCKS, v);

/** Copies only known config keys, falling back to defaults for anything missing or the wrong type. */
function sanitizeConfig(kind: BlockKind, raw: unknown): NodeConfig {
  const def = BLOCKS[kind];
  const input = isRecord(raw) ? raw : {};
  const config: NodeConfig = {};
  for (const [key, fallback] of Object.entries(def.defaults)) {
    const value = input[key];
    const options = def.fields.find((f) => f.key === key)?.options;
    if (typeof fallback === 'number') {
      config[key] = (typeof value === 'number' && Number.isFinite(value)) || value === '' ? value : fallback;
    } else if (typeof value === 'string' && value.length <= 500 && (!options || options.includes(value))) {
      config[key] = value;
    } else {
      config[key] = fallback;
    }
  }
  return config;
}

/**
 * Parses and validates workflow JSON from an untrusted source (a file or browser storage).
 * Only known fields are copied, so unknown or malicious keys never reach application state.
 * Structural problems fail the import; recoverable ones are fixed and reported as warnings.
 *
 * Migration strategy: when WORKFLOW_VERSION is raised, add a migration step here that upgrades
 * older documents before validation, so files exported by earlier versions keep loading.
 */
export function parseWorkflow(text: string): ParseResult {
  if (text.length > MAX_WORKFLOW_BYTES) return fail('The file is too large (limit 1 MB).');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('The file is not valid JSON.');
  }
  if (!isRecord(raw)) return fail('Expected a JSON object at the top level.');
  if (raw.schema !== WORKFLOW_SCHEMA) return fail('This is not a NEXA Forge workflow file (missing or unknown "schema").');
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) return fail('The workflow has a missing or invalid "version".');
  if (raw.version > WORKFLOW_VERSION) {
    return fail(`This workflow uses format version ${raw.version}, which is newer than this app supports (version ${WORKFLOW_VERSION}).`);
  }
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return fail('"nodes" and "edges" must both be arrays.');
  if (raw.nodes.length > MAX_NODES) return fail(`Too many blocks (limit ${MAX_NODES}).`);
  if (raw.edges.length > MAX_EDGES) return fail(`Too many connections (limit ${MAX_EDGES}).`);

  const warnings: string[] = [];
  const nodes: NexaNode[] = [];
  const kinds = new Map<string, BlockKind>();

  for (const [i, entry] of raw.nodes.entries()) {
    if (!isRecord(entry)) return fail(`Block ${i + 1} is not an object.`);
    const { id, kind } = entry;
    if (typeof id !== 'string' || id.length === 0 || id.length > 100) return fail(`Block ${i + 1} has a missing or invalid "id".`);
    if (kinds.has(id)) return fail(`Duplicate block id "${id}".`);
    if (!isBlockKind(kind)) return fail(`Block "${id}" has an unknown type "${String(kind)}".`);

    let label = BLOCKS[kind].title;
    if (typeof entry.label === 'string' && entry.label.trim()) label = entry.label.slice(0, 80);
    else warnings.push(`Block "${id}" had no name; used "${label}".`);

    const pos = entry.position;
    let position = { x: 0, y: 0 };
    if (isRecord(pos) && Number.isFinite(pos.x) && Number.isFinite(pos.y)) position = { x: Number(pos.x), y: Number(pos.y) };
    else warnings.push(`Block "${label}" had no valid position and was placed at the origin.`);

    kinds.set(id, kind);
    nodes.push({ id, type: 'nexa', position, data: { kind, label, config: sanitizeConfig(kind, entry.config) } });
  }

  const edges: NexaEdge[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const entry of raw.edges) {
    const source = isRecord(entry) ? entry.source : undefined;
    const target = isRecord(entry) ? entry.target : undefined;
    const sourceKind = typeof source === 'string' ? kinds.get(source) : undefined;
    const targetKind = typeof target === 'string' ? kinds.get(target) : undefined;
    const pair = `${String(source)}->${String(target)}`;
    const valid =
      typeof source === 'string' &&
      typeof target === 'string' &&
      source !== target &&
      sourceKind !== undefined &&
      targetKind !== undefined &&
      BLOCKS[sourceKind].hasOutput &&
      BLOCKS[targetKind].hasInput &&
      !seen.has(pair);
    if (!valid) {
      dropped += 1;
      continue;
    }
    seen.add(pair);
    edges.push({ id: `e-${source}-${target}`, source, target });
  }
  if (dropped > 0) warnings.push(`${dropped} invalid or duplicate connection${dropped === 1 ? ' was' : 's were'} ignored.`);

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : 'Untitled project';
  return { ok: true, name, nodes, edges, warnings };
}
