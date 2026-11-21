# Changelog

All notable changes to NEXA Forge are recorded here. The project is an early-stage developer preview, so anything may change between versions.

## [Unreleased]

### Added
- Workflow execution engine (`src/engine`): validation and ordering of blocks, typed events, errors and per-block status, simulated adapters, and a timer runner that guarantees a single timer. Covered by unit tests, including a check that the engine never imports React.
- Docker and Kubernetes blocks now log a one-time preparation message at the start of a run (configuration only, clearly marked as simulated).
- Workflow problems found at run time (blocks no sensor reaches, invalid connections, loops, invalid settings) are reported once in the Event Log.
- Public website: a homepage at `/` and developer documentation at `/docs` (quick start, installation, editor, simulation, export, project generation, limitations, troubleshooting), with a real Studio screenshot. Small built-in router with no new dependencies.
- Autosave of the current project to browser storage, with a Saved / Saving / Save failed indicator and Ctrl+S to save immediately.
- Project is restored after a page refresh. Corrupted saved data is never discarded silently: a copy is kept in browser storage and the user is told.
- Workflow JSON import with strict validation (schema, version, size limit, unknown block types, duplicate ids, invalid connections). Only known fields are copied into application state.
- New project, plus confirmation dialogs before anything that replaces the canvas (New, Import, Example, Clear).
- Automated tests (Vitest) for workflow serialization, import and validation, the simulation engine, persistence and project generation.
- Continuous integration workflow (lint, build, test).
- ARCHITECTURE.md and a developer-preview release checklist.

### Changed
- Simulated MQTT and Cloud API events are marked "· simulated" in the Event Log.
- The simulation hook is now a thin adapter over the engine. A block with invalid settings now fails visibly instead of silently using 0, and a loop in the workflow is reported instead of being skipped silently.
- The Studio editor moved from `/` to `/studio`. The editor itself is unchanged. It is loaded lazily, which also removes the large-chunk build warning.
- Page title and description updated from the Vite template default.
- Generated projects now keep settings in `simulator/config.json` instead of embedding them in Python source, so user-entered text can never become executable code.
- Values written into generated Docker Compose and Kubernetes YAML are quoted, so they cannot inject extra fields.
- Generated Dockerfile runs as a non-root user. The generated MQTT broker is bound to `127.0.0.1` only.
- Generated README states plainly that readings are simulated and the output is an untested starter template.
- `MQTT_BROKER` and `API_URL` environment variables override the generated endpoints. The simulator refuses non-http(s) URLs.
- Status label changed from "Prototype" to "Developer preview".
- Toolbar buttons "Clear" now have distinct accessible names.

### Fixed
- Generated simulator now follows the editor's data flow: MQTT publishing and API alerts happen only when every Logic block on the route passes. Previously it published every reading to MQTT, and a disconnected Logic block triggered API alerts for all sensors.
- Generated simulator no longer crashes on empty numeric settings; invalid numbers fall back to the block defaults.
- Autosave no longer fires (or shows "Saving") when only the selection changes.

### Removed
- Unused Vite template files (`src/App.css`, template images, `public/icons.svg`).

## 0.0.0 - initial prototype
- Visual workflow editor, six block types, Inspector, validation, mock simulation, JSON export and project generation.
