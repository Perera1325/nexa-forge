# Changelog

All notable changes to NEXA Forge are recorded here. The project is an early-stage developer preview, so anything may change between versions.

## [Unreleased]

### Added
- Autosave of the current project to browser storage, with a Saved / Saving / Save failed indicator and Ctrl+S to save immediately.
- Project is restored after a page refresh. Corrupted saved data is never discarded silently: a copy is kept in browser storage and the user is told.
- Workflow JSON import with strict validation (schema, version, size limit, unknown block types, duplicate ids, invalid connections). Only known fields are copied into application state.
- New project, plus confirmation dialogs before anything that replaces the canvas (New, Import, Example, Clear).
- Automated tests (Vitest) for workflow serialization, import and validation, the simulation engine, persistence and project generation.
- Continuous integration workflow (lint, build, test).
- ARCHITECTURE.md and a developer-preview release checklist.

### Changed
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
