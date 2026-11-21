# NEXA Forge

> One workspace, from tiny chips to intelligent cloud.

A visual, node-based development environment for embedded, edge and cloud workflows, running entirely in the browser.

> **Status: early-stage developer preview.** NEXA Forge is software-only. It is not production-ready, does not talk to real hardware, and its file formats and APIs will change.

## Overview

NEXA Forge lets you design a data pipeline by connecting blocks on a canvas: a simulated sensor, decision logic, messaging, a cloud endpoint, and container and cluster deployment. You can simulate the data flow with mock readings, save and reload your work, export and import the workflow as JSON, and generate a starter project from it.

## Vision and problem statement

Building an IoT or edge system touches many layers: device firmware, messaging, cloud services, containers and orchestration. Each layer has its own tools and configuration formats, which makes the first working end-to-end prototype slow and hard to reason about.

The long-term vision is one visual workspace where an engineer can describe that whole pipeline, validate it, simulate it and turn it into runnable project scaffolding. This repository is the first step: the editor, the simulation loop, local project saving and the project generator. Most of the vision is not built yet (see [Roadmap](#roadmap)).

## Current features

- **Visual workflow editor:** drag blocks from a categorised palette onto a canvas and connect them (built on `@xyflow/react`). Blocks can also be added from the keyboard.
- **Six block types:** Virtual Sensor (Sources), Logic (Processing), MQTT and Cloud API (Connectivity), Docker and Kubernetes (Deployment).
- **Inspector:** edit a block's name and configuration, with hints and inline validation, and see its connections.
- **Workflow check:** structural and configuration validation. Clicking an issue jumps to the block.
- **Mock simulation:** virtual sensors generate sine, random or ramp data. Data flows along the connections, Logic blocks gate it on a condition, and live values, sparklines and an event log update every second.
- **Projects in your browser:** the project autosaves to browser storage and is restored after a refresh. Status shows Saved, Saving or Save failed. Ctrl+S saves immediately. New project and confirmations protect against accidental loss.
- **Workflow JSON export and import:** versioned JSON. Imports are validated, and malformed or newer-format files are rejected with a clear message.
- **Project generation:** a starter project you can preview and download as a `.zip`: a Python simulator with `config.json`, `requirements.txt`, a Dockerfile, a Docker Compose file with a local MQTT broker, Kubernetes manifests and a README. Generation happens in the browser and nothing is uploaded.
- **Accessibility and responsive layout:** keyboard-operable controls, visible focus, landmarks, reduced-motion support, and side panels that become drawers on narrow screens.

## Technology stack

React 19, TypeScript, Vite, `@xyflow/react`, plain CSS with design tokens, Vitest for tests, oxlint for linting. There is no backend.

## Installation (Git Bash)

Prerequisites: [Node.js](https://nodejs.org/) (version 20.19+ or 22.12+) and Git.

```bash
git clone https://github.com/Perera1325/nexa-forge.git
cd nexa-forge
npm install
```

## Run the development server

```bash
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`. The public homepage is at `/`, the workflow editor at `/studio` and the developer documentation at `/docs` (for example `http://localhost:5173/studio`).

Other scripts:

```bash
npm run build       # type-check and create a production build in dist/
npm run preview     # serve the production build locally
npm run lint        # run oxlint (static analysis)
npm test            # run the automated tests (Vitest)
npm run typecheck   # TypeScript only
```

## Try it

1. Click **Run simulation** to stream mock data through the example workflow, then **Stop simulation**.
2. Select a block and edit its settings in the Inspector.
3. Click **Export JSON**, then use **Import** to load a workflow file back.
4. Click **Generate project** to preview and download the starter project.
5. Refresh the page. Your project is restored from browser storage.

## Documentation

- The in-app documentation at `/docs`: quick start, editor, simulation, export, generation, limitations and troubleshooting
- [ARCHITECTURE.md](ARCHITECTURE.md): code structure, data model and extension points
- [CHANGELOG.md](CHANGELOG.md)
- [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)

## Current limitations

- **Simulation only.** No real sensors, microcontrollers, firmware or hardware are involved. Readings are generated mock data.
- **The MQTT and Cloud API blocks make no network calls in the editor.** The simulation only logs what would be sent. Generated simulators can publish and POST, but that has not been tested against production services.
- **Generated projects are starter templates.** They have not been security-reviewed or validated against a production broker, registry or Kubernetes cluster. Review them before using them anywhere real. The Kubernetes manifests expect an MQTT broker they do not deploy.
- **Local storage only.** Projects live in this browser's storage. There is no cloud sync, accounts or collaboration. Clearing browser data deletes the project, so use Export JSON for backups.
- **No undo/redo.**
- **Basic logic.** One comparison per Logic block and a single value flowing through the graph.
- **Test coverage is partial.** Logic, persistence and generation are unit tested. The user interface has been checked with manual and scripted browser runs, but there is no automated browser test suite in the repository yet.
- Data formats, block configuration and generated output may change without notice.

## Roadmap

These are goals, not commitments.

- [ ] Undo/redo and multiple saved projects
- [ ] Automated browser tests for the editor
- [ ] More block types and richer logic (multiple conditions, transforms, custom code)
- [ ] Generator improvements: validated templates, configurable targets, CI-checked output
- [ ] Optional connection to a real MQTT broker for testing
- [ ] Hardware and platform targets (for example ESP32, embedded Linux, edge AI platforms), only after the software foundation is solid
- [ ] Cloud and platform integrations (for example AWS, OpenChoreo), not started

## Contributing

Contributions, bug reports and ideas are welcome. The project is early and changing quickly.

1. Open an issue to discuss larger changes before starting work.
2. Fork the repository and create a branch (`git checkout -b feature/short-description`).
3. Keep changes focused and follow the existing TypeScript structure (see [ARCHITECTURE.md](ARCHITECTURE.md)).
4. Make sure `npm run lint`, `npm run build` and `npm test` pass. Add tests for new logic.
5. Describe what changed and how you tested it in the pull request.

Please be respectful and constructive in all discussions.

## License

No license has been selected yet. Until one is added, all rights are reserved by the author and the code may not be reused without permission. Common choices for open-source projects include MIT and Apache-2.0 (permissive), and GPL or AGPL (copyleft). The maintainer decides.

## Author

Created and maintained by Vinod Perera.
