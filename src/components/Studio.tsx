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
import { Dock, type DockTab } from './BottomPanels';
import { JsonDialog, ProjectDialog } from './Dialogs';
import { BlocksIcon, BoxIcon, BracesIcon, CloseIcon, LogoMark, PlayIcon, SlidersIcon, StopIcon } from './icons';

const nodeTypes: NodeTypes = { nexa: NexaNodeView };
const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#59606d', width: 16, height: 16 },
};
const demo = createDemoWorkflow();
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type Output = { kind: 'json'; json: string; summary: string } | { kind: 'project'; files: GeneratedFile[] } | null;
type Drawer = 'palette' | 'inspector' | null;

export function Studio() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NexaNode>(demo.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<NexaEdge>(demo.edges);
  const [name, setName] = useState('Factory Temperature Monitor');
  const [output, setOutput] = useState<Output>(null);
  const [dockTab, setDockTab] = useState<DockTab>('log');
  const [drawer, setDrawer] = useState<Drawer>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const sim = useSimulation(nodes, edges);

  const selected = nodes.find((n) => n.selected);
  const issues = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);
  const sensorCount = nodes.filter((n) => n.data.kind === 'sensor').length;
  const slug = slugify(name);

  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warnCount = issues.length - errorCount;
  const check =
    nodes.length === 0
      ? { dot: 'off', text: 'Empty workflow' }
      : errorCount > 0
        ? { dot: 'error', text: plural(errorCount, 'error') }
        : warnCount > 0
          ? { dot: 'alert', text: plural(warnCount, 'warning') }
          : { dot: 'live', text: 'Workflow valid' };

  // Only edges that carried data this tick animate and take the accent colour.
  const kindById = useMemo(() => new Map(nodes.map((n) => [n.id, n.data.kind])), [nodes]);
  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const rt = sim.runtime[e.source];
        const flowing = !!rt?.active && !(kindById.get(e.source) === 'logic' && rt.passed === false);
        return { ...e, animated: flowing, className: flowing ? 'is-flowing' : undefined };
      }),
    [edges, sim.runtime, kindById],
  );

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
    addNode(kind, { x: center.x - 112 + jitter, y: center.y - 50 + jitter });
    setDrawer(null);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData(DRAG_MIME) as BlockKind;
    if (!(kind in BLOCKS)) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode(kind, { x: position.x - 112, y: position.y - 40 });
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

  const focusNode = (id: string) => {
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
    fitView({ nodes: [{ id }], maxZoom: 1, duration: 200, padding: 0.6 });
  };

  const loadDemo = () => {
    const fresh = createDemoWorkflow();
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    requestAnimationFrame(() => fitView({ padding: 0.2, maxZoom: 1 }));
  };
  const clearAll = () => {
    setNodes([]);
    setEdges([]);
  };

  const exportJson = () =>
    setOutput({
      kind: 'json',
      json: JSON.stringify(buildWorkflow(name, nodes, edges), null, 2),
      summary: `${plural(nodes.length, 'block')} · ${plural(edges.length, 'connection')}`,
    });
  const generate = () => setOutput({ kind: 'project', files: generateProject(name, nodes, edges) });

  return (
    <div className="app">
      <a className="skip-link" href="#canvas">
        Skip to canvas
      </a>
      <div className="sr-only" role="status">
        {sim.running ? 'Simulation running' : 'Simulation stopped'}
      </div>

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">
            <LogoMark />
          </span>
          <h1 className="brand__name">NEXA Forge</h1>
        </div>
        <span className="divider" aria-hidden="true" />
        <input
          className="project-name"
          value={name}
          maxLength={60}
          spellCheck={false}
          onChange={(e) => setName(e.target.value)}
          aria-label="Project name"
          title="Project name (used for exported file names)"
        />
        <span className="tag" title="NEXA Forge is an early prototype">
          Prototype
        </span>

        <div className="topbar__right">
          <div className="sim-status" title="Simulation state">
            <span className={`status-dot status-dot--${sim.running ? 'live' : 'off'}`} aria-hidden="true" />
            {sim.running ? `Running · tick ${sim.tick}` : 'Simulation idle'}
          </div>
          {sim.running ? (
            <button className="btn" onClick={sim.stop} aria-label="Stop simulation" title="Stop the simulation">
              <StopIcon /> <span className="btn-label">Stop</span>
            </button>
          ) : (
            <button
              className="btn"
              onClick={sim.start}
              disabled={sensorCount === 0}
              aria-label="Run simulation"
              title={sensorCount === 0 ? 'Add a Virtual Sensor to run the simulation' : 'Run the simulation with mock sensor data'}
            >
              <PlayIcon /> <span className="btn-label">Run simulation</span>
            </button>
          )}
          <button className="btn" onClick={exportJson} disabled={nodes.length === 0} aria-label="Export JSON" title="View and download the workflow as JSON">
            <BracesIcon /> <span className="btn-label">Export JSON</span>
          </button>
          <button className="btn btn-primary" onClick={generate} disabled={nodes.length === 0} aria-label="Generate project" title="Generate a runnable project from this workflow">
            <BoxIcon /> <span className="btn-label">Generate project</span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`rail rail--left ${drawer === 'palette' ? 'is-open' : ''}`} aria-label="Block palette">
          <Sidebar onAdd={addFromPalette} onClose={() => setDrawer(null)} />
        </aside>

        <main className="canvas-col">
          <div className="toolbar" role="toolbar" aria-label="Canvas tools">
            <button className="btn btn-icon only-narrow" onClick={() => setDrawer('palette')} aria-label="Open block palette" title="Block palette">
              <BlocksIcon />
            </button>
            <span className="metric">
              <strong>{nodes.length}</strong> {nodes.length === 1 ? 'block' : 'blocks'}
            </span>
            <span className="metric">
              <strong>{edges.length}</strong> {edges.length === 1 ? 'connection' : 'connections'}
            </span>
            <span className="metric metric--secondary">
              <strong>{sensorCount}</strong> {sensorCount === 1 ? 'sensor' : 'sensors'}
            </span>
            <div className="toolbar__right">
              <button className="pill" onClick={() => setDockTab('check')} title="Open Workflow check">
                <span className={`status-dot status-dot--${check.dot}`} aria-hidden="true" />
                {check.text}
              </button>
              <button className="btn btn-sm btn-quiet" onClick={loadDemo} title="Replace the canvas with an example workflow">
                Load example
              </button>
              <button className="btn btn-sm btn-quiet" onClick={clearAll} disabled={nodes.length === 0} title="Remove all blocks and connections">
                Clear
              </button>
              <button className="btn btn-icon only-narrow" onClick={() => setDrawer('inspector')} aria-label="Open inspector" title="Inspector and live data">
                <SlidersIcon />
              </button>
            </div>
          </div>

          <div className="canvas" id="canvas" tabIndex={-1} role="region" aria-label="Workflow canvas" ref={canvasRef} onDrop={onDrop} onDragOver={onDragOver}>
            <RuntimeContext.Provider value={sim.runtime}>
              <ReactFlow
                nodes={nodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                isValidConnection={(c) => c.source !== c.target}
                defaultEdgeOptions={defaultEdgeOptions}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#2a2f38" />
                <Controls showInteractive={false} />
                {nodes.length > 8 && <MiniMap ariaLabel="Workflow minimap" pannable zoomable nodeStrokeWidth={0} />}
              </ReactFlow>
            </RuntimeContext.Provider>

            {nodes.length === 0 && (
              <div className="canvas-empty">
                <div className="canvas-empty__card">
                  <h2>Start a workflow</h2>
                  <p>
                    Connect a Virtual Sensor to logic, messaging and deployment blocks, simulate the data flow with mock readings, then generate a runnable
                    project.
                  </p>
                  <div className="canvas-empty__actions">
                    <button className="btn btn-primary" onClick={loadDemo}>
                      Load example workflow
                    </button>
                  </div>
                  <p className="canvas-empty__hint">Or drag a block from the palette. Select a block and press Delete to remove it.</p>
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className={`rail rail--right ${drawer === 'inspector' ? 'is-open' : ''}`} aria-label="Inspector and live data">
          <div className="rail__close only-narrow">
            <button className="btn btn-icon btn-quiet" onClick={() => setDrawer(null)} aria-label="Close panel" title="Close">
              <CloseIcon />
            </button>
          </div>
          <Inspector node={selected} nodes={nodes} edges={edges} onLabel={onLabel} onConfig={onConfig} onDelete={onDelete} />
          <LivePanel nodes={nodes} history={sim.history} running={sim.running} />
        </aside>

        <div className={`scrim ${drawer ? 'is-open' : ''}`} onClick={() => setDrawer(null)} aria-hidden="true" />
      </div>

      <Dock tab={dockTab} onTab={setDockTab} logs={sim.logs} issues={issues} nodeCount={nodes.length} onClear={sim.reset} onFocusNode={focusNode} />

      {output?.kind === 'json' && <JsonDialog json={output.json} summary={output.summary} filename={`${slug}.workflow.json`} onClose={() => setOutput(null)} />}
      {output?.kind === 'project' && <ProjectDialog files={output.files} zipName={`${slug}.zip`} onClose={() => setOutput(null)} />}
    </div>
  );
}
