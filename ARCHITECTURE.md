# Architecture

NEXA Forge is a client-side single-page app. There is no backend: all state lives in the browser.

```
src/
  types.ts                 Node, edge, log and issue types
  blocks.ts                Block catalog: fields, defaults, categories (the single source of truth)
  lib/
    workflow.ts            Workflow data model, export, import (parseWorkflow) and validation
    storage.ts             Load/save the project in browser storage (storage is injectable for tests)
    generator.ts           Turns a workflow into starter project files and its README
    guide.ts               Remembers that the first-workflow guide was closed
    zip.ts, files.ts       Dependency-free ZIP writer and download helpers
    nodes.ts               Node factory and the example workflow
  examples/index.ts        Example workflow gallery data (built with the same node factory as the editor)
  guide/steps.ts           Steps of the optional first-workflow guide
  engine/                  Workflow execution engine: pure TypeScript, no React or DOM (see "Execution engine")
    types.ts               Graph, events, errors, node status, step outputs
    plan.ts                Validation and execution order (buildPlan)
    engine.ts              Step-by-step executor (createEngine)
    adapters.ts            Simulated sensor, MQTT, API, Docker and Kubernetes adapters
    runner.ts              Timer around the engine: exactly one timer while running
    logic.ts               Logic block comparison
  simulation/              UI adapter for the engine
    useSimulation.ts       React hook: owns UI state, creates and disposes the runner
    presenter.ts           Engine events to Event Log rows
  hooks/useAutosave.ts     Debounced autosave and save status
  components/              UI: Studio (composition root), Sidebar, Inspector, dialogs, panels
```

## Principles
- **Pure logic is separate from UI.** `lib/*` and `engine/*` have no React or DOM dependency and are unit tested. A test fails if an engine file imports React, `@xyflow/react` or any UI folder.
- **One block catalog.** Adding a block means one entry in `blocks.ts`. The palette, Inspector, node card and validation read from it. The simulation engine and generator also need a branch for the new kind.
- **Untrusted input is parsed, not trusted.** Imported files and stored data go through `parseWorkflow`, which copies only known, correctly typed fields.
- **Generated text is never executable by accident.** User text goes into `config.json` or quoted YAML scalars, never into Python source.

## Workflow file format
JSON with `schema: "nexa-forge/workflow"`, an integer `version` (currently 1), `name`, `exportedAt`, `nodes` (`id`, `kind`, `label`, `position`, `config`) and `edges` (`id`, `source`, `target`).

Compatibility: files from older versions must keep importing. When `WORKFLOW_VERSION` is raised, add a migration step at the top of `parseWorkflow` that upgrades older documents before validation. Files with a newer version are rejected with a clear message.

## Execution engine
Layers, from data to screen: **data model** (`types.ts`, `blocks.ts`, `lib/workflow.ts`) → **validation** (`validateConfig` in `lib/workflow.ts`, and `engine/plan.ts`) → **execution engine** (`engine/engine.ts`) → **adapters** (`engine/adapters.ts`) → **UI** (`simulation/*`, `components/*`). Each layer only knows the ones before it.

- **Plan.** `buildPlan({ nodes, edges })` never throws. It ignores invalid connections (missing block, self-loop, duplicate, out of a block without an output or into one without an input), flags unknown block types and invalid settings, finds blocks no sensor can reach, detects loops, and returns the runnable blocks in topological order (Kahn's algorithm, stable for the stored order). Every problem is a typed `ExecutionError` (`code`, `level`, `message`, `nodeId`/`edgeId`).
- **Engine.** `createEngine()` has `start(graph)`, `tick(graph)`, `stop()` and `reset()`. A step runs the blocks in plan order. Each block receives the readings of the sensors upstream of it, at most one per sensor per step. Sensors read through the adapter, Logic blocks keep only the readings whose condition is true, MQTT and Cloud API blocks produce one event per reading and pass the reading on, Docker and Kubernetes blocks only receive it. The graph is passed on every call, so edits while running apply on the next step. The plan is cached per graph identity.
- **Status per block.** `idle`, `ok`, `blocked` (Logic condition false), `prepared` (Docker/Kubernetes), `skipped` (cannot run) or `failed` (invalid settings, or an exception), with the last value and a run count.
- **Events.** Typed `ExecutionEvent`s (`kind`, `level`, `source`, `message`, `tick`, `nodeId`, `data`). Levels are `debug`, `info`, `event`, `warn`, `error`. Each distinct problem is reported once per run, not on every step. Events that stand for an external action carry `data.simulated`.
- **Failures.** Invalid settings fail only that block, and what is downstream of it receives nothing. An exception inside a block is caught, marks the block `failed` and reports one error event. The rest of the workflow keeps running.
- **Adapters.** The only place a block touches "the outside world". The default adapters are simulated: they return a record of what would be published, requested or prepared, with `simulated: true`, and nothing opens a connection. A real adapter would have to be written and passed to `createEngine({ adapters })` explicitly; nothing creates one by default.
- **Runner.** `createRunner()` drives an engine with an injected scheduler. `start()` returns false if a run is active, so a second timer cannot exist; `stop()` and `dispose()` clear the timer; an unexpected engine error stops the run and calls `onError`.
- **UI.** `useSimulation` creates one runner per mounted component and disposes it on unmount. `presenter.ts` maps events to Event Log rows: debug events are hidden, and errors are shown with the existing warning style and an "Error:" prefix.

## Examples and onboarding
`src/examples` holds the example workflows as plain builders that return nodes and edges in the normal workflow model, so loading one is the same as importing a file. A test checks that every example uses supported blocks, has valid settings and connections, produces no validation or planning issues, survives export/import and save/restore, simulates without problems and generates a project. The first-workflow guide (`components/Guide.tsx`, text in `guide/steps.ts`) is a non-blocking card; closing it is remembered in browser storage (`lib/guide.ts`).

## Generated projects
`lib/generator.ts` writes the files listed in the Studio preview. The Python simulator reads `simulator/config.json` and is offline by default: it contacts an MQTT broker or an API only when started with `--send-mqtt` or `--send-api`. The README is built from the workflow (its sensors, data routes and settings) and states what is simulated.

## Extending
Future integration targets (ESP32/Arduino, embedded Linux, edge AI platforms, MQTT, AWS, OpenChoreo) are not implemented. The intended extension points are new entries in `blocks.ts` and new generator targets in `lib/generator.ts`.

## Routing and public website
There is no router dependency. `src/router.ts` maps `window.location.pathname` to a page (`resolveRoute`, unit tested) and `src/Link.tsx` navigates with the History API. `/` is the public homepage, `/docs` the developer documentation and `/studio` the editor; anything else shows a not-found page. `App.tsx` loads the Studio lazily (`StudioRoute.tsx`, which also owns the `@xyflow/react` CSS and provider), so the public pages do not download the editor. The Studio code itself is not touched by the website. The site lives in `src/site/` with its own `site.css`, reusing the design tokens from `index.css`; block names and descriptions on the pages are read from `blocks.ts` so they cannot drift from the app. `public/studio-preview.png` is a real screenshot of the Studio. A static host must serve `index.html` for unknown paths so that `/studio` and `/docs` work when opened directly.
