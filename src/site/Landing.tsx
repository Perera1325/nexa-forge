import { BLOCKS, BLOCK_ORDER, CATEGORIES } from '../blocks';
import { BlockIcon } from '../components/icons';
import { Link } from '../Link';
import { CodeBlock, Layout } from './Layout';
import { CLONE_URL, CONTRIBUTING_URL, ISSUES_URL, REPO_URL } from './links';

const CAPABILITIES: Array<[string, string]> = [
  ['Visual workflow editor', 'Drag blocks onto a canvas and connect them. Blocks can also be added from the keyboard.'],
  ['Inspector and workflow check', 'Edit each block’s settings with inline validation. A checker lists structural and configuration problems and jumps to the block.'],
  ['Mock simulation', 'Virtual sensors generate sine, random or ramp data. It flows along your connections, Logic blocks gate it, and live values and an event log update every second.'],
  ['JSON export and import', 'Save a workflow as versioned JSON and load it back. Imports are validated and malformed files are rejected with a clear message.'],
  ['Project generation', 'Preview and download a starter project as a .zip: a Python simulator, Docker and Compose files, Kubernetes manifests and a README. It is built in your browser.'],
  ['Autosave in your browser', 'Your project is restored after a refresh. There is no account and no server; clearing browser data removes it.'],
];

const NOT_YET = [
  'No real sensors, microcontrollers or firmware. All readings are mock data.',
  'The MQTT and Cloud API blocks make no network calls in the editor; the simulation only logs what would be sent.',
  'Generated projects are untested starter templates, not validated against a production broker, registry or cluster.',
  'No undo/redo, one saved project, and no cloud sync or collaboration.',
  'Logic is basic: one comparison per Logic block.',
  'No automated browser test suite yet. Data formats may change without notice.',
];

const ROADMAP = [
  'Undo/redo and multiple saved projects',
  'Automated browser tests for the editor',
  'More block types and richer logic',
  'Better generator templates, checked in CI',
  'Optional connection to a real MQTT broker for testing',
  'Hardware and platform targets (for example ESP32, embedded Linux, edge AI), only after the software foundation is solid',
  'Cloud and platform integrations, not started',
];

export function Landing() {
  return (
    <Layout title="NEXA Forge · Visual workflows from embedded systems to the cloud">
      <section className="wrap hero">
        <p className="eyebrow">
          <span className="tag">Developer preview</span>
        </p>
        <h1>NEXA Forge — Design workflows from embedded systems to cloud infrastructure.</h1>
        <p className="lede">
          A software-first visual development environment for exploring, connecting, and simulating engineering workflows across embedded, edge, and cloud
          technologies.
        </p>
        <p className="cta-row">
          <Link href="/studio" className="btn btn-primary btn-lg">
            Open Studio
          </Link>
          <Link href="/docs#quick-start" className="btn btn-lg">
            Quick start
          </Link>
          <a href={REPO_URL} className="btn btn-lg" target="_blank" rel="noopener noreferrer">
            View on GitHub<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
        <p className="muted-text">Runs entirely in your browser. Simulation only — no real hardware is involved.</p>
      </section>

      <section className="wrap" aria-labelledby="preview-h">
        <h2 id="preview-h" className="sr-only">
          Studio preview
        </h2>
        <figure className="preview">
          <img
            src="/studio-preview.png"
            width="1440"
            height="900"
            alt="NEXA Forge Studio showing the example workflow: a block palette on the left, a canvas connecting a virtual sensor through logic to MQTT, a cloud API, Docker and Kubernetes, an inspector with live data on the right, and an event log below."
          />
          <figcaption>The Studio with the built-in example workflow, running the simulation. This is a real screenshot of the current application.</figcaption>
        </figure>
      </section>

      <section className="wrap section-block" aria-labelledby="overview-h">
        <h2 id="overview-h">What it is</h2>
        <div className="prose">
          <p>
            Building an IoT or edge system touches many layers: device firmware, messaging, cloud services, containers and orchestration. Each layer has its
            own tools and configuration formats, which makes the first working end-to-end prototype slow and hard to reason about.
          </p>
          <p>
            NEXA Forge is an experiment in describing that whole pipeline in one place. You connect blocks on a canvas, check the workflow, simulate the data flow
            with mock readings, and turn the result into starter project files. Most of the long-term vision is not built yet; this repository is the first step.
          </p>
        </div>
      </section>

      <section className="wrap section-block" aria-labelledby="cap-h">
        <h2 id="cap-h">What works today</h2>
        <ul className="cards">
          {CAPABILITIES.map(([title, text]) => (
            <li key={title} className="card">
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap section-block" aria-labelledby="how-h">
        <h2 id="how-h">How the workflow editor works</h2>
        <ol className="steps">
          <li>
            <h3>Build</h3>
            <p>Add blocks from the palette and draw connections from outputs to inputs.</p>
          </li>
          <li>
            <h3>Configure</h3>
            <p>Select a block and set its values in the Inspector. The Workflow check reports anything missing or miswired.</p>
          </li>
          <li>
            <h3>Simulate</h3>
            <p>Run the simulation. Sensors emit mock data, Logic blocks decide what passes, and the Live Data panel and Event Log show the result.</p>
          </li>
          <li>
            <h3>Export or generate</h3>
            <p>Export the workflow as JSON, or generate a starter project and download it as a .zip.</p>
          </li>
        </ol>
        <h3 className="sub-h">Blocks available now</h3>
        <div className="block-groups">
          {CATEGORIES.map((category) => (
            <div key={category} className="block-group">
              <h4>{category}</h4>
              <ul>
                {BLOCK_ORDER.filter((kind) => BLOCKS[kind].category === category).map((kind) => (
                  <li key={kind}>
                    <span className="nx-node__icon">
                      <BlockIcon kind={kind} />
                    </span>
                    <span>
                      <strong>{BLOCKS[kind].title}</strong>
                      <span className="muted-text block-desc">{BLOCKS[kind].description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap section-block" aria-labelledby="status-h">
        <h2 id="status-h">Developer Preview status</h2>
        <p className="prose-lede">
          NEXA Forge is early-stage software, not a mature platform. It is useful for exploring the idea and for feedback. These are the current limits:
        </p>
        <ul className="plain-list">
          {NOT_YET.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="wrap section-block" aria-labelledby="tech-h">
        <h2 id="tech-h">Technology direction</h2>
        <div className="two-col">
          <div>
            <h3 className="sub-h">Built with</h3>
            <p className="prose-lede">React 19, TypeScript, Vite, @xyflow/react, plain CSS with design tokens, Vitest and oxlint. There is no backend.</p>
          </div>
          <div>
            <h3 className="sub-h">Where it may go</h3>
            <p className="muted-text">These are goals, not commitments.</p>
            <ul className="plain-list">
              {ROADMAP.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="wrap section-block" aria-labelledby="qs-h">
        <h2 id="qs-h">Try it locally</h2>
        <CodeBlock
          label="quick start commands"
          code={`git clone ${CLONE_URL}\ncd nexa-forge\nnpm install\nnpm run dev`}
        />
        <p className="muted-text">
          Then open <code>http://localhost:5173/studio</code>. The <Link href="/docs#quick-start">quick start</Link> covers the example workflow, simulation and
          export step by step.
        </p>
      </section>

      <section className="wrap section-block" aria-labelledby="oss-h">
        <h2 id="oss-h">Open source and project status</h2>
        <p className="prose-lede">
          The code is public on GitHub. Bug reports, ideas and focused contributions are welcome. The project is young and one person maintains it, so expect
          things to change.
        </p>
        <ul className="link-list">
          <li>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              Repository<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
          <li>
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
              Issues and feedback<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
          <li>
            <a href={CONTRIBUTING_URL} target="_blank" rel="noopener noreferrer">
              How to contribute<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        </ul>
        <p className="muted-text">No license has been selected yet; until one is added, all rights are reserved by the author.</p>
      </section>

      <section className="wrap cta-band" aria-labelledby="cta-h">
        <h2 id="cta-h">Open the Studio and load the example workflow.</h2>
        <p className="cta-row">
          <Link href="/studio" className="btn btn-primary btn-lg">
            Open Studio
          </Link>
          <Link href="/docs" className="btn btn-lg">
            Read the docs
          </Link>
        </p>
      </section>
    </Layout>
  );
}
