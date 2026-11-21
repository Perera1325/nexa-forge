# Architecture

NEXA Forge is a client-side single-page app. There is no backend: all state lives in the browser.
src/
types.ts Node, edge, log and issue types
blocks.ts Block catalog: fields, defaults, categories (the single source of truth)
lib/
workflow.ts Workflow data model, export, import (parseWorkflow) and validation
storage.ts Load/save the project in browser storage (storage is injectable for tests)
generator.ts Turns a workflow into starter project files
zip.ts, files.ts Dependency-free ZIP writer and download helpers
nodes.ts Node factory and the example workflow
simulation/
engine.ts Pure simulation step (runTick), no React
useSimulation.ts Timer, history and event log around the engine
hooks/useAutosave.ts Debounced autosave and save status
components/ UI: Studio (composition root), Sidebar, Inspector, dialogs, panels


## Principles
- **Pure logic is separate from UI.** `lib/*` and `simulation/engine.ts` have no React or DOM dependency and are unit tested.
- **One block catalog.** Adding a block means one entry in `blocks.ts`. The palette, Inspector, node card and validation read from it. The simulation engine and generator also need a branch for the new kind.
- **Untrusted input is parsed, not trusted.** Imported files and stored data go through `parseWorkflow`, which copies only known, correctly typed fields.
- **Generated text is never executable by accident.** User text goes into `config.json` or quoted YAML scalars, never into Python source.

## Workflow file format
JSON with `schema: "nexa-forge/workflow"`, an integer `version` (currently 1), `name`, `exportedAt`, `nodes` (`id`, `kind`, `label`, `position`, `config`) and `edges` (`id`, `source`, `target`).

Compatibility: files from older versions must keep importing. When `WORKFLOW_VERSION` is raised, add a migration step at the top of `parseWorkflow` that upgrades older documents before validation. Files with a newer version are rejected with a clear message.

## Simulation
`runTick(nodes, edges, tick)` generates one reading per Virtual Sensor and walks the edges downstream. Logic blocks stop the flow when their condition is false. A visited-set guards against cycles. Everything is simulated: no network, broker or hardware access.

## Extending
Future integration targets (ESP32/Arduino, embedded Linux, edge AI platforms, MQTT, AWS, OpenChoreo) are not implemented. The intended extension points are new entries in `blocks.ts` and new generator targets in `lib/generator.ts`.
