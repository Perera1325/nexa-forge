# NEXA Forge

A visual, node-based development environment for embedded, edge and cloud workflows, running entirely in the browser.

> **Status: early prototype.** NEXA Forge is a software-only proof of concept. It is not production-ready, does not talk to real hardware, and the APIs and file formats will change.

## Overview

NEXA Forge lets you design a data pipeline by connecting blocks on a canvas: a simulated sensor, decision logic, messaging, a cloud endpoint, and container and cluster deployment. You can simulate the data flow with mock readings, export the workflow as JSON, and generate a starter project from it.

## Vision and problem statement

Building an IoT or edge system touches many layers: device firmware, messaging, cloud services, containers and orchestration. Each layer has its own tools and configuration formats, which makes the first working end-to-end prototype slow and hard to reason about.

The long-term vision for NEXA Forge is one visual workspace where an engineer can describe that whole pipeline, validate it, simulate it and turn it into runnable project scaffolding. This repository is the first step: a working prototype of the editor, the simulation loop and the project generator. Most of the vision is not built yet (see [Roadmap](#roadmap)).

## Current prototype features

- **Visual workflow editor:** drag blocks from a categorised palette onto a canvas and connect them (built on `@xyflow/react`). Blocks can also be added from the keyboard.
- **Six block types:**
  - Virtual Sensor (Sources)
  - Logic (Processing)
  - MQTT and Cloud API (Connectivity)
  - Docker and Kubernetes (Deployment)
- **Inspector:** edit a block's name and configuration, with hints and inline validation. It also lists the block's incoming and outgoing connections.
- **Workflow check:** structural and configuration validation. Issues are listed in a panel, and clicking one jumps to the block.
- **Mock simulation:** virtual sensors generate sine, random or ramp data. Data flows along the connections, Logic blocks gate it on a condition, and live values, sparklines and an event log update each second. Everything runs in the browser.
- **Workflow JSON export:** view, copy or download the workflow as JSON.
- **Project generation:** produces a starter project you can inspect file by file and download as a `.zip`. It contains a Python simulator, `requirements.txt`, a Dockerfile, a Docker Compose file with an MQTT broker, Kubernetes manifests and a README. Generation happens locally in the browser, and nothing is uploaded.
- **Accessibility and responsive layout:** keyboard-operable controls, visible focus, landmarks, reduced-motion support, and side panels that become drawers on narrow screens.

## Technology stack

- React 19 and TypeScript
- Vite
- `@xyflow/react` (React Flow) for the node editor
- Plain CSS with design tokens (no UI framework)

There is no backend. All state lives in the browser and is lost on refresh.

## Installation (Git Bash)

Prerequisites: [Node.js](https://nodejs.org/) (a current LTS version) and Git.

```bash
git clone https://github.com/<your-username>/<repository-name>.git
cd <repository-name>
npm install
```

## Run the development server

```bash
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`.

Other scripts:

```bash
npm run build     # type-check and create a production build in dist/
npm run preview   # serve the production build locally
npm run lint      # run ESLint (if configured in your checkout)
```

## Try it

1. Click **Run simulation** to stream mock data through the example workflow.
2. Select a block and edit its settings in the Inspector.
3. Click **Export JSON** to view the workflow definition.
4. Click **Generate project** to preview and download the starter project.

## Current limitations

- **Simulation only.** No real sensors, microcontrollers, firmware or hardware are involved. Readings are generated mock data.
- **MQTT and Cloud API blocks do not make network calls in the editor.** The simulation only logs what *would* be sent.
- **Generated projects are starter templates.** They have not been validated against a production broker, registry or Kubernetes cluster. Review and test them before using them anywhere real.
- **No persistence.** Workflows are not saved or loaded. Use the JSON export to keep a copy.
- **No JSON import yet**, and no undo/redo.
- **Basic logic only.** One comparison per Logic block, and a single data value flowing through the graph.
- **No authentication, collaboration or backend services.**
- **No automated test suite yet.**
- The data formats, block configuration and generated output may change without notice.

## Roadmap

These are goals, not commitments, and the order may change.

- [ ] Save and load workflows (local storage, then file import and export)
- [ ] Import workflow JSON, plus undo/redo
- [ ] Automated tests (unit tests for the simulation and generator, end-to-end tests for the editor)
- [ ] More block types and richer logic (multiple conditions, transforms, custom code)
- [ ] Generator improvements: validated templates, configurable targets, CI-checked output
- [ ] Optional connection to a real MQTT broker for testing
- [ ] Hardware targets, only after the software foundation is solid
- [ ] Documentation and examples

## Contributing

Contributions, bug reports and ideas are welcome, though the project is early and still changing quickly.

1. Open an issue to discuss larger changes before starting work.
2. Fork the repository and create a branch (`git checkout -b feature/short-description`).
3. Keep changes focused. Follow the existing TypeScript and file structure.
4. Make sure `npm run build` passes before opening a pull request.
5. Describe what changed and how you tested it.

Please be respectful and constructive in all discussions.

## License

No license has been selected yet. Until one is added, all rights are reserved by the author and the code may not be reused without permission.

## Author

Created and maintained by Vinod Perera.
