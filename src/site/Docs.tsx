import { BLOCKS, BLOCK_ORDER } from '../blocks';
import { Link } from '../Link';
import { CodeBlock, Layout } from './Layout';
import { ARCHITECTURE_URL, CHANGELOG_URL, CLONE_URL, ISSUES_URL, REPO_URL } from './links';

const TOC: Array<[string, string]> = [
  ['overview', 'Overview'],
  ['quick-start', 'Quick start'],
  ['prerequisites', 'Prerequisites'],
  ['installation', 'Installation'],
  ['local-development', 'Local development'],
  ['running', 'Running the application'],
  ['editor', 'Using the workflow editor'],
  ['simulation', 'Running the simulation'],
  ['export', 'Exporting workflow JSON'],
  ['generate', 'Generating a project'],
  ['limitations', 'Current limitations'],
  ['troubleshooting', 'Troubleshooting'],
];

const SCRIPTS: Array<[string, string]> = [
  ['npm run dev', 'Start the Vite development server with hot reload.'],
  ['npm run build', 'Type-check, then create a production build in dist/.'],
  ['npm run preview', 'Serve the production build locally.'],
  ['npm run lint', 'Run oxlint.'],
  ['npm test', 'Run the unit tests once (Vitest).'],
  ['npm run typecheck', 'Run the TypeScript check only.'],
];

export function Docs() {
  return (
    <Layout title="Documentation · NEXA Forge">
      <div className="wrap docs">
        <nav className="docs-toc" aria-label="On this page">
          <p className="docs-toc__title">On this page</p>
          <ul>
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="docs-body">
          <header className="page-head page-head--docs">
            <p className="eyebrow">
              <span className="tag">Developer preview</span>
            </p>
            <h1>Documentation</h1>
            <p className="lede">How to install, run and use NEXA Forge. This page describes only what the current version does.</p>
          </header>

          <section id="overview" aria-labelledby="overview-h">
            <h2 id="overview-h">Overview</h2>
            <p>
              NEXA Forge is a browser-based, node-based editor. You connect blocks on a canvas to describe a pipeline from a data source to messaging, a cloud
              endpoint and container deployment. You can simulate the data flow with mock readings, export the workflow as JSON, and generate a starter project
              from it.
            </p>
            <p>
              It is software-only and runs entirely in your browser. There is no backend, no account and no connection to real hardware. For the code structure
              and data model, see <a href={ARCHITECTURE_URL} target="_blank" rel="noopener noreferrer">ARCHITECTURE.md<span className="sr-only"> (opens in a new tab)</span></a>.
            </p>
          </section>

          <section id="quick-start" aria-labelledby="qs-h">
            <h2 id="qs-h">Quick start</h2>
            <ol className="doc-steps">
              <li>
                <strong>Clone the repository and install dependencies.</strong>
                <CodeBlock label="clone and install commands" code={`git clone ${CLONE_URL}\ncd nexa-forge\nnpm install`} />
              </li>
              <li>
                <strong>Start the development server.</strong>
                <CodeBlock label="dev server command" code="npm run dev" />
              </li>
              <li>
                <strong>Open the application.</strong> Go to the address Vite prints, usually <code>http://localhost:5173</code>, then choose{' '}
                <strong>Open Studio</strong> or go straight to <code>http://localhost:5173/studio</code>.
              </li>
              <li>
                <strong>Load the example workflow.</strong> On a first visit the example is already on the canvas. At any time, click <strong>Example</strong> in
                the toolbar above the canvas to replace the canvas with it (Studio asks for confirmation if the canvas is not empty). (An empty canvas shows a <strong>Load example workflow</strong> button.)
              </li>
              <li>
                <strong>Run the simulation.</strong> Click <strong>Run simulation</strong> in the top bar. Watch the Live Data panel and the Event Log. Click{' '}
                <strong>Stop</strong> to end it.
              </li>
              <li>
                <strong>Export the workflow.</strong> Click <strong>Export JSON</strong>, then <strong>Download JSON</strong> or <strong>Copy</strong>.
              </li>
            </ol>
          </section>

          <section id="prerequisites" aria-labelledby="pre-h">
            <h2 id="pre-h">Prerequisites</h2>
            <ul>
              <li>
                <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer">
                  Node.js<span className="sr-only"> (opens in a new tab)</span>
                </a>{' '}
                version 20.19 or newer, or 22.12 or newer (required by Vite 8). npm comes with Node.
              </li>
              <li>Git, to clone the repository.</li>
              <li>A current desktop browser. Docker, Kubernetes and Python are only needed if you want to run a generated project.</li>
            </ul>
          </section>

          <section id="installation" aria-labelledby="inst-h">
            <h2 id="inst-h">Installation</h2>
            <CodeBlock label="installation commands" code={`git clone ${CLONE_URL}\ncd nexa-forge\nnpm install`} />
            <p>
              The repository is <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Perera1325/nexa-forge<span className="sr-only"> (opens in a new tab)</span></a>.
            </p>
          </section>

          <section id="local-development" aria-labelledby="dev-h">
            <h2 id="dev-h">Local development</h2>
            <p>These scripts are defined in <code>package.json</code>:</p>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="npm scripts">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Command</th>
                    <th scope="col">What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {SCRIPTS.map(([cmd, text]) => (
                    <tr key={cmd}>
                      <td>
                        <code>{cmd}</code>
                      </td>
                      <td>{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Before opening a pull request, run <code>npm run lint</code>, <code>npm run build</code> and <code>npm test</code>. Source lives in{' '}
              <code>src/</code>; the editor is in <code>src/components/</code>, the simulation in <code>src/simulation/</code>, and workflow, storage and generator
              logic in <code>src/lib/</code>.
            </p>
          </section>

          <section id="running" aria-labelledby="run-h">
            <h2 id="run-h">Running the application</h2>
            <p>The site has three pages:</p>
            <ul>
              <li>
                <code>/</code> — the public overview.
              </li>
              <li>
                <code>/studio</code> — the workflow editor.
              </li>
              <li>
                <code>/docs</code> — this documentation.
              </li>
            </ul>
            <p>
              For a production build, run <code>npm run build</code> and then <code>npm run preview</code>. If you host the contents of <code>dist/</code> on a
              static host, configure it to serve <code>index.html</code> for unknown paths, so that opening <code>/studio</code> or <code>/docs</code> directly
              works.
            </p>
          </section>

          <section id="editor" aria-labelledby="ed-h">
            <h2 id="ed-h">Using the workflow editor</h2>
            <ol className="doc-steps">
              <li>
                <strong>Add blocks.</strong> Drag a block from the <em>Blocks</em> palette onto the canvas, or focus it and press Enter. Use the filter box to
                search.
              </li>
              <li>
                <strong>Connect them.</strong> Drag from a block’s output handle to another block’s input handle. A block cannot connect to itself.
              </li>
              <li>
                <strong>Configure.</strong> Select a block to edit its name and settings in the Inspector on the right.
              </li>
              <li>
                <strong>Check.</strong> The pill above the canvas shows the workflow status. Click it to open <em>Workflow check</em>, and click an issue to jump
                to the block.
              </li>
              <li>
                <strong>Delete.</strong> Select a block or connection and press Delete or Backspace.
              </li>
            </ol>
            <p>
              The toolbar also has <strong>New</strong> (start an empty project), <strong>Import</strong> (load a workflow <code>.json</code> file),{' '}
              <strong>Example</strong> and <strong>Clear</strong>. Each asks for confirmation before replacing the canvas. Your project autosaves to this browser;
              press Ctrl+S to save immediately.
            </p>
            <h3>Blocks</h3>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Available blocks">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Block</th>
                    <th scope="col">Category</th>
                    <th scope="col">Description</th>
                    <th scope="col">Settings</th>
                  </tr>
                </thead>
                <tbody>
                  {BLOCK_ORDER.map((kind) => (
                    <tr key={kind}>
                      <th scope="row">{BLOCKS[kind].title}</th>
                      <td>{BLOCKS[kind].category}</td>
                      <td>{BLOCKS[kind].description}</td>
                      <td>{BLOCKS[kind].fields.map((f) => f.label).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="simulation" aria-labelledby="sim-h">
            <h2 id="sim-h">Running the simulation</h2>
            <p>
              Click <strong>Run simulation</strong> in the top bar. It needs at least one Virtual Sensor. Once a second, each sensor generates a mock value
              (sine, random or ramp, within its minimum and maximum). The value follows your connections; a Logic block passes it on only when its condition is
              true, and the MQTT and Cloud API blocks log what they would send.
            </p>
            <ul>
              <li>
                <strong>Live Data</strong> (right panel) shows current values and sparklines.
              </li>
              <li>
                <strong>Event Log</strong> (bottom) lists simulation events, such as a Logic condition being met, an MQTT publish or an API request.
              </li>
            </ul>
            <p>
              Everything is simulated. The MQTT and Cloud API blocks only log what they would send, and the Docker and Kubernetes blocks log a one-time preparation message when the run starts. Nothing connects to a broker or API, builds an image or touches a cluster. A block with invalid settings is reported once in the Event Log as an error and does not run, and blocks that are not connected to a sensor are reported and skipped. Click <strong>Stop</strong> to end the run.
            </p>
          </section>

          <section id="export" aria-labelledby="exp-h">
            <h2 id="exp-h">Exporting workflow JSON</h2>
            <p>
              Click <strong>Export JSON</strong> to view the workflow, then <strong>Download JSON</strong> or <strong>Copy</strong>. The file is versioned
              (<code>"schema": "nexa-forge/workflow"</code>). To load one back, use <strong>Import</strong> in the toolbar. Imports are validated: files that are
              not valid JSON, not a NEXA Forge workflow, over 1 MB, or from a newer format version are rejected with a message, and invalid connections are
              dropped with a warning.
            </p>
            <p>Browser storage is not a backup. Export JSON to keep a copy of anything you care about.</p>
          </section>

          <section id="generate" aria-labelledby="gen-h">
            <h2 id="gen-h">Generating a project</h2>
            <p>
              Click <strong>Generate project</strong> to preview the files, then download single files or <strong>Download all (.zip)</strong>. Generation happens
              in your browser and nothing is uploaded. Depending on the blocks in your workflow, the project contains:
            </p>
            <ul>
              <li>
                <code>workflow.json</code>, <code>simulator/simulator.py</code>, <code>simulator/config.json</code>, <code>requirements.txt</code> and a{' '}
                <code>README.md</code>
              </li>
              <li>
                <code>Dockerfile</code> and <code>docker-compose.yml</code> (with a local MQTT broker), if the workflow has a Docker block
              </li>
              <li>
                <code>k8s/namespace.yaml</code>, <code>k8s/deployment.yaml</code> and <code>k8s/service.yaml</code>, if it has a Kubernetes block
              </li>
            </ul>
            <p>
              The generated simulator follows the same routing as the editor: MQTT and API output happen only when every Logic block on the route passes. Its
              settings are read from <code>config.json</code>. Run it with:
            </p>
            <CodeBlock label="generated project commands" code={'pip install -r requirements.txt\npython simulator/simulator.py'} />
            <p>
              Generated projects are starter templates. They have not been security-reviewed or tested against a production broker, registry or cluster. Review
              every file before using it anywhere real.
            </p>
          </section>

          <section id="limitations" aria-labelledby="lim-h">
            <h2 id="lim-h">Current limitations</h2>
            <ul>
              <li>Simulation only. No real sensors, microcontrollers, firmware or hardware.</li>
              <li>The editor’s MQTT and Cloud API blocks make no network calls.</li>
              <li>Generated projects are untested starter templates; the Kubernetes manifests expect an MQTT broker they do not deploy.</li>
              <li>Projects are stored in this browser only: no cloud sync, accounts or collaboration, and only one saved project.</li>
              <li>No undo/redo.</li>
              <li>Basic logic: one comparison per Logic block. The generator uses the first MQTT block and the first Cloud API block.</li>
              <li>Generate still works when the Workflow check reports errors.</li>
              <li>Two browser tabs editing at once can overwrite each other’s saved project.</li>
              <li>No automated browser test suite yet. Formats and generated output may change without notice.</li>
            </ul>
            <p>
              Version history is in the <a href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer">changelog<span className="sr-only"> (opens in a new tab)</span></a>.
            </p>
          </section>

          <section id="troubleshooting" aria-labelledby="ts-h">
            <h2 id="ts-h">Troubleshooting</h2>
            <dl className="faq">
              <dt>The install or dev server fails with an engine or syntax error.</dt>
              <dd>
                Check your Node version with <code>node --version</code>. You need 20.19+ or 22.12+.
              </dd>
              <dt>Port 5173 is already in use.</dt>
              <dd>
                Vite picks the next free port and prints it. Use the address shown in the terminal, or run <code>npm run dev -- --port 3000</code>.
              </dd>
              <dt>
                <strong>Run simulation</strong> is disabled.
              </dt>
              <dd>The workflow has no Virtual Sensor. Add one, or click Example.</dd>
              <dt>
                <strong>Export JSON</strong> and <strong>Generate project</strong> are disabled.
              </dt>
              <dd>The canvas is empty. Add blocks or load the example.</dd>
              <dt>Nothing reaches MQTT or the Cloud API during the simulation.</dt>
              <dd>
                Data reaches a block only through connections, and a Logic block passes it only when its condition is true. Check the connections, and the Logic
                block’s operator and threshold. The example’s threshold is below the sensor’s maximum, so alerts appear when the value rises above it.
              </dd>
              <dt>My project disappeared.</dt>
              <dd>
                Projects live in this browser’s storage. Clearing site data, private browsing or a different browser or address (for example another port) starts
                with an empty store. Export JSON for backups. If saved data is unreadable, Studio tells you and keeps a copy under the storage key{' '}
                <code>nexa-forge:project:corrupt</code>.
              </dd>
              <dt>An import is rejected.</dt>
              <dd>The message says why: invalid JSON, not a NEXA Forge workflow, too large, or a newer format version. Fix or re-export the file.</dd>
              <dt>Opening /studio directly on my own host shows a 404.</dt>
              <dd>
                Configure the static host to serve <code>index.html</code> for unknown paths. The Vite dev and preview servers already do.
              </dd>
              <dt>Something else is wrong.</dt>
              <dd>
                Search or open an issue at{' '}
                <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
                  GitHub Issues<span className="sr-only"> (opens in a new tab)</span>
                </a>{' '}
                with your Node version, browser and the steps that led to the problem.
              </dd>
            </dl>
            <p className="cta-row">
              <Link href="/studio" className="btn btn-primary">
                Open Studio
              </Link>
            </p>
          </section>
        </article>
      </div>
    </Layout>
  );
}
