import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type NodeTypes,
} from '@xyflow/react';
import { BLOCKS, DRAG_MIME } from '../blocks';
import { createDemoWorkflow, createNode } from '../lib/nodes';
import { buildWorkflow, validateWorkflow } from '../lib/workflow';
import { generateProject } from '../lib/generator';
import { slugify } from '../lib/files';
import { RuntimeContext } from '../simulation/RuntimeContext';
import { useSimulation } from '../simulation/useSimulation';
import type { BlockKind, ConfigValue, GeneratedFile, NexaEdge, NexaNode, NexaNodeData } from '../types';
import { NexaNodeView } from './NexaNodeView';
import { Sidebar } from './Sidebar';
import { Inspector } from './Inspector';
import { LivePanel } from './LivePanel';
import { EventLog, HealthCheck } from './BottomPanels';
import { JsonDialog, ProjectDialog } from './Dialogs';

const nodeTypes: NodeTypes = { nexa: NexaNodeView };
const defaultEdgeOptions = { type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } };
const demo = createDemoWorkflow();

type Output = { kind: 'json'; json: string } | { kind: 'project'; files: GeneratedFile[] } | null;

export function Studio() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NexaNode>(demo.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<NexaEdge>(demo.edges);
  const [name, setName] = useState('Factory Temperature Monitor');
  const [output, setOutput] = useState<Output>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const sim = useSimulation(nodes, edges);

  const selected = nodes.find((n) => n.selected);
  const issues = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);
  const displayEdges = useMemo(() => edges.map((e) => ({ ...e, animated: sim.running })), [edges, sim.running]);
  const sensorCount = nodes.filter((n) => n.data.kind === 'sensor').length;
  const slug = slugify(name);

  const addNode = useCallback(
    (kind: BlockKind, position: { x: number; y: number }) => {
      const node = { ...createNode(kind, position), selected: true };
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node]);
    },
    [setNodes],
  );

  const addFromPalette = (kind: BlockKind) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 100, y: 100 };
    const jitter = (nodes.length % 6) * 24;
    addNode(kind, { x: center.x - 95 + jitter, y: center.y - 40 + jitter });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData(DRAG_MIME) as BlockKind;
    if (!(kind in BLOCKS)) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode(kind, { x: position.x - 95, y: position.y - 35 });
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge(c, es)), [setEdges]);

  const updateData = useCallback(
    (id: string, patch: (d: NexaNodeData) => NexaNodeData) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: patch(n.data) } : n))),
    [setNodes],
  );
  const onLabel = (id: string, label: string) => updateData(id, (d) => ({ ...d, label }));
  const onConfig = (id: string, key: string, value: ConfigValue) =>
    updateData(id, (d) => ({ ...d, config: { ...d.config, [key]: value } }));
  const onDelete = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  };

  const refit = () => requestAnimationFrame(() => fitView({ padding: 0.2, maxZoom: 1 }));
  const loadDemo = () => {
    const fresh = createDemoWorkflow();
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    refit();
  };
  const clearAll = () => {
    setNodes([]);
    setEdges([]);
  };

  const exportJson = () =>
    setOutput({ kind: 'json', json: JSON.stringify(buildWorkflow(name, nodes, edges), null, 2) });
  const generate = () => setOutput({ kind: 'project', files: generateProject(name, nodes, edges) });

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">N</span>
          <div>
            <div className="brand__name">NEXA Forge</div>
            <div className="muted">Visual platform for embedded · edge AI · Linux · cloud</div>
          </div>
        </div>
        <input className="project-name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Project name" />
        <div className="actions">
          {sim.running ? (
            <button className="btn btn-danger" onClick={sim.stop}>
              ■ Stop Simulation
            </button>
          ) : (
            <button className="btn btn-primary" onClick={sim.start} disabled={sensorCount === 0}>
              ▶ Run Simulation
            </button>
          )}
          <button className="btn" onClick={exportJson} disabled={nodes.length === 0}>
            Export JSON
          </button>
          <button className="btn btn-accent" onClick={generate} disabled={nodes.length === 0}>
            Generate Project
          </button>
        </div>
      </header>

      <section className="stats">
        <div className="stat"><span>Blocks</span><strong>{nodes.length}</strong></div>
        <div className="stat"><span>Connections</span><strong>{edges.length}</strong></div>
        <div className="stat"><span>Virtual sensors</span><strong>{sensorCount}</strong></div>
        <div className="stat">
          <span>Simulation</span>
          <strong className={sim.running ? 'ok' : ''}>{sim.running ? `Running · tick ${sim.tick}` : 'Idle'}</strong>
        </div>
        <div className="stat">
          <span>Workflow</span>
          <strong className={issues.length === 0 ? 'ok' : 'warn'}>{issues.length === 0 ? 'Valid' : `${issues.length} issue(s)`}</strong>
        </div>
        <div className="stat-actions">
          <button className="btn btn-ghost btn-sm" onClick={loadDemo}>Load demo</button>
          <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear canvas</button>
        </div>
      </section>

      <main className="main">
        <Sidebar onAdd={addFromPalette} />
        <div className="canvas" ref={canvasRef}>
          <RuntimeContext.Provider value={sim.runtime}>
            <ReactFlow
              nodes={nodes}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              isValidConnection={(c) => c.source !== c.target}
              defaultEdgeOptions={defaultEdgeOptions}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} />
              <Controls />
              <MiniMap pannable zoomable nodeColor={(n) => BLOCKS[(n as NexaNode).data.kind]?.accent ?? '#64748b'} />
            </ReactFlow>
          </RuntimeContext.Provider>
        </div>
        <div className="side-right">
          <Inspector node={selected} onLabel={onLabel} onConfig={onConfig} onDelete={onDelete} />
          <LivePanel nodes={nodes} history={sim.history} running={sim.running} />
        </div>
      </main>

      <footer className="bottom">
        <EventLog logs={sim.logs} onClear={sim.reset} />
        <HealthCheck issues={issues} />
      </footer>

      {output?.kind === 'json' && (
        <JsonDialog json={output.json} filename={`${slug}.workflow.json`} onClose={() => setOutput(null)} />
      )}
      {output?.kind === 'project' && (
        <ProjectDialog files={output.files} zipName={`${slug}.zip`} onClose={() => setOutput(null)} />
      )}
    </div>
  );
}
