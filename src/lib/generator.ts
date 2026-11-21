import { BLOCKS } from '../blocks';
import type { BlockKind, ConfigValue, GeneratedFile, NexaEdge, NexaNode } from '../types';
import { slugify } from './files';
import { buildWorkflow } from './workflow';

const ofKind = (nodes: NexaNode[], kind: BlockKind) => nodes.filter((n) => n.data.kind === kind);

/** Quotes a value as a YAML scalar. JSON strings are valid YAML, so user text can never break out of its field. */
const yamlString = (value: unknown) => JSON.stringify(String(value));

/** A numeric setting, falling back to the block default when the value is empty or not a number. */
function num(kind: BlockKind, key: string, value: ConfigValue | undefined): number {
  const n = value === '' || value === undefined ? Number.NaN : Number(value);
  return Number.isFinite(n) ? n : Number(BLOCKS[kind].defaults[key]);
}

export interface Route {
  sensor: string;
  /** Logic blocks the data must pass, in order, before it reaches the target. */
  via: string[];
  target: 'mqtt' | 'api';
}

/**
 * Mirrors the editor simulation: data flows from each sensor along the connections, and only reaches
 * the MQTT / Cloud API block when every Logic block on the way is satisfied. Disconnected blocks get no routes.
 */
export function computeRoutes(nodes: NexaNode[], edges: NexaEdge[], mqtt?: NexaNode, api?: NexaNode): Route[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const routes: Route[] = [];
  const seen = new Set<string>();
  let budget = 20000; // keeps pathological graphs from taking forever

  const walk = (node: NexaNode, sensor: string, via: string[], path: Set<string>): void => {
    if (path.has(node.id) || budget-- <= 0) return;
    const nextPath = new Set(path).add(node.id);
    let nextVia = via;
    if (node.data.kind === 'logic') nextVia = [...via, node.id];
    if (node === mqtt || node === api) {
      const target = node === mqtt ? 'mqtt' : 'api';
      const key = `${sensor}|${target}|${via.join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        routes.push({ sensor, via, target });
      }
    }
    for (const e of edges) {
      const next = e.source === node.id ? byId.get(e.target) : undefined;
      if (next) walk(next, sensor, nextVia, nextPath);
    }
  };

  for (const s of nodes.filter((n) => n.data.kind === 'sensor')) {
    for (const e of edges) {
      const next = e.source === s.id ? byId.get(e.target) : undefined;
      if (next) walk(next, s.id, [], new Set([s.id]));
    }
  }
  return routes;
}

const REQUIREMENTS = `# Only needed for MQTT publishing (python simulator/simulator.py --send-mqtt).
# Everything else uses the Python standard library.
paho-mqtt>=2.0
`;

function simulatorPy(): string {
  return `"""NEXA Forge virtual sensor simulator (generated).

All sensor readings are simulated. No real hardware is accessed.
Settings live in config.json next to this file; nothing is executed from it.

By default the simulator only prints readings. It contacts nothing until you ask it to:
  --send-mqtt   publish readings that pass their rules to the configured MQTT broker
  --send-api    send readings that pass their rules to the configured API endpoint
"""
import argparse
import json
import math
import os
import random
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CONFIG = json.loads(Path(__file__).with_name("config.json").read_text(encoding="utf-8"))

try:
    import paho.mqtt.client as mqtt
except ImportError:  # MQTT is optional - readings are always printed
    mqtt = None

OPS = {
    ">": lambda a, b: a > b,
    "<": lambda a, b: a < b,
    ">=": lambda a, b: a >= b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
}


def number(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def read_sensor(sensor, tick):
    lo, hi = number(sensor["min"]), number(sensor["max"])
    if hi <= lo:
        return lo
    mid, amp = (lo + hi) / 2, (hi - lo) / 2
    pattern = sensor.get("pattern", "sine")
    if pattern == "random":
        value = random.uniform(lo, hi)
    elif pattern == "ramp":
        value = lo + (tick * (hi - lo) / 30) % (hi - lo)
    else:
        value = mid + amp * 0.8 * math.sin(tick / 6) + random.uniform(-amp, amp) * 0.1
    return round(min(max(value, lo), hi), 2)


def connect_mqtt():
    cfg = CONFIG["mqtt"]
    if not cfg:
        print("[mqtt] the workflow has no MQTT block (printing readings only)", file=sys.stderr)
        return None
    if mqtt is None:
        print("[mqtt] paho-mqtt is not installed: run pip install -r requirements.txt (printing readings only)", file=sys.stderr)
        return None
    broker = os.environ.get("MQTT_BROKER", str(cfg["broker"]))
    host, _, port = broker.partition(":")
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    except AttributeError:
        client = mqtt.Client()
    try:
        client.connect(host, int(port or 1883))
    except OSError as exc:
        print(f"[mqtt] cannot connect to {broker}: {exc} (printing readings only)", file=sys.stderr)
        return None
    client.loop_start()
    return client


def post_alert(payload):
    cfg = CONFIG["api"]
    if not cfg:
        return
    url = os.environ.get("API_URL", str(cfg["url"]))
    if not url.startswith(("http://", "https://")):
        print(f"[api] refusing non-http(s) URL: {url}", file=sys.stderr)
        return
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method=str(cfg.get("method", "POST")),
    )
    try:
        urllib.request.urlopen(request, timeout=5)
    except Exception as exc:  # network errors must not stop the simulator
        print(f"[api] request failed: {exc}", file=sys.stderr)


def parse_args():
    parser = argparse.ArgumentParser(description="NEXA Forge virtual sensor simulator (simulated data only).")
    parser.add_argument("--ticks", type=int, default=0, help="stop after this many steps (default: run until Ctrl+C)")
    parser.add_argument("--interval", type=float, default=1.0, help="seconds between steps (default: 1)")
    parser.add_argument("--send-mqtt", action="store_true", help="publish to the MQTT broker from config.json (needs paho-mqtt and a reachable broker)")
    parser.add_argument("--send-api", action="store_true", help="send requests to the API URL from config.json")
    return parser.parse_args()


def main():
    args = parse_args()
    client = connect_mqtt() if args.send_mqtt else None
    topic = CONFIG["mqtt"]["topic"] if CONFIG["mqtt"] else None
    rules = {rule["id"]: rule for rule in CONFIG["rules"]}
    mode = [name for name, on in (("MQTT", args.send_mqtt), ("API", args.send_api)) if on]
    print(f"[nexa] simulated sensor data. Sending: {', '.join(mode) if mode else 'nothing (printing only)'}", file=sys.stderr)
    tick = 0
    try:
        while args.ticks <= 0 or tick < args.ticks:
            tick += 1
            for sensor in CONFIG["sensors"]:
                value = read_sensor(sensor, tick)
                # Same model as the NEXA Forge editor: a route delivers data only if every Logic block on it passes.
                passed = {rid: OPS[rule["operator"]](value, number(rule["threshold"])) for rid, rule in rules.items()}
                routes = [route for route in CONFIG["routes"] if route["sensor"] == sensor["id"]]
                open_targets = {route["target"] for route in routes if all(passed.get(rid, False) for rid in route["via"])}
                payload = {
                    "sensor": sensor["name"],
                    "type": sensor["sensorType"],
                    "value": value,
                    "unit": sensor["unit"],
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
                triggered = [rules[rid]["name"] for rid in dict.fromkeys(rid for route in routes for rid in route["via"]) if passed.get(rid)]
                if triggered:
                    payload["alert"] = ", ".join(triggered)
                print(json.dumps(payload), flush=True)
                if args.send_mqtt and "mqtt" in open_targets and client and topic:
                    client.publish(topic, json.dumps(payload), qos=int(number(CONFIG["mqtt"].get("qos", 0))))
                if args.send_api and "api" in open_targets:
                    post_alert(payload)
            if args.ticks <= 0 or tick < args.ticks:
                time.sleep(max(args.interval, 0))
    except KeyboardInterrupt:
        print("[nexa] stopped", file=sys.stderr)
    if client:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
`;
}


const md = (value: unknown) => String(value).replace(/[`\r\n]+/g, ' ').trim();

interface ReadmeContext {
  name: string;
  nodes: NexaNode[];
  edges: NexaEdge[];
  files: GeneratedFile[];
  simConfig: { sensors: Array<{ id: string; name: string; min: number; max: number }>; routes: Route[] };
  mqtt?: NexaNode;
  api?: NexaNode;
  docker?: NexaNode;
  k8s?: NexaNode;
  image: string;
}

/** The README of the generated project. It describes only what the generated files do. */
function buildReadme(ctx: ReadmeContext): string {
  const { name, nodes, files, simConfig, mqtt, api, docker, k8s, image } = ctx;
  const label = (id: string) => md(nodes.find((n) => n.id === id)?.data.label ?? id);
  const paths = [...files.map((f) => f.path), 'README.md'].sort();

  const routeLines = simConfig.routes.map((r) => {
    const target = r.target === 'mqtt' ? `MQTT topic \`${md(mqtt?.data.config.topic)}\`` : `Cloud API \`${md(api?.data.config.url)}\``;
    const rules = r.via.length > 0 ? `only when ${r.via.map((id) => `**${label(id)}**`).join(' and ')} pass${r.via.length === 1 ? 'es' : ''}` : 'for every reading';
    return `- **${label(r.sensor)}** → ${target}, ${rules}`;
  });

  const sensorRows = simConfig.sensors.map((s) => `| ${md(s.name)} | ${md((s as Record<string, unknown>).pattern)} | ${s.min} to ${s.max} ${md((s as Record<string, unknown>).unit)} |`);

  const sections: string[] = [];
  sections.push(`# ${md(name)}

Generated by NEXA Forge (early-stage developer preview) on ${new Date().toISOString()}.

This is a **starter project**: a small Python simulator that reproduces your workflow on your own computer, plus optional container files. It has not been security-reviewed, and NEXA Forge has not tested it against a real MQTT broker, API, container registry or Kubernetes cluster. Review every file before using it anywhere real.`);

  sections.push(`## What is real and what is simulated

| Part | What it does |
| --- | --- |
| Sensor readings | **Simulated.** Values are generated from the settings in \`simulator/config.json\`. No real hardware or sensor is involved. |
| Logic rules | Evaluated for real in Python on the simulated values. |
| MQTT | Off by default. With \`--send-mqtt\` the simulator publishes to the broker in the config if \`paho-mqtt\` is installed and the broker is reachable; otherwise it keeps printing. Untested against your broker. |
| Cloud API | Off by default. With \`--send-api\` it sends HTTP requests to the URL in the config. The default URL is a placeholder, so change it first. Untested against your endpoint. |
| Docker and Kubernetes | Plain starter files, if your workflow has those blocks. Nothing is built, pushed or deployed for you. |`);

  sections.push(`## Folder structure

\`\`\`text
${paths.join('\n')}
\`\`\`

- \`simulator/simulator.py\` runs the simulation. It reads its settings from \`simulator/config.json\` and never executes them.
- \`workflow.json\` is your workflow from NEXA Forge. You can import it again with **Import** in the Studio.`);

  sections.push(`## Your workflow

${sensorRows.length > 0 ? `| Sensor | Pattern | Range |\n| --- | --- | --- |\n${sensorRows.join('\n')}` : 'This workflow has no Virtual Sensor, so the simulator has nothing to simulate.'}

${routeLines.length > 0 ? `Where the data goes:\n\n${routeLines.join('\n')}` : 'No sensor is connected to an MQTT or Cloud API block, so readings are only printed.'}${mqtt && ofKind(nodes, 'mqtt').length > 1 ? '\n\nOnly the first MQTT block is used by the generated simulator.' : ''}${api && ofKind(nodes, 'cloudApi').length > 1 ? '\n\nOnly the first Cloud API block is used by the generated simulator.' : ''}`);

  sections.push(`## Requirements

- Python 3.9 or newer.
- \`paho-mqtt\` (listed in \`requirements.txt\`), only if you use \`--send-mqtt\`. Everything else is in the Python standard library.`);

  sections.push(`## Run the simulator

\`\`\`bash
python -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt  # only needed for --send-mqtt
python simulator/simulator.py --ticks 10 --interval 0.5
\`\`\`

It prints one JSON reading per sensor per step. A reading that satisfies a Logic rule gets an \`alert\` field. Without \`--ticks\` it runs until you press Ctrl+C.

| Option | Meaning |
| --- | --- |
| \`--ticks N\` | Stop after N steps (default: run until Ctrl+C). |
| \`--interval S\` | Seconds between steps (default: 1). |
| \`--send-mqtt\` | Publish readings that pass their rules to the MQTT broker. |
| \`--send-api\` | Send readings that pass their rules to the API URL. |`);

  sections.push(`## Configuration

All settings are in \`simulator/config.json\`. Edit it and run the simulator again. This is the current content:

\`\`\`json
${JSON.stringify(simConfig, null, 2)}
\`\`\`

- \`sensors\`: name, unit, \`min\`, \`max\` and \`pattern\` (\`sine\`, \`random\` or \`ramp\`) of each simulated sensor.
- \`rules\`: Logic blocks. A reading passes when \`value operator threshold\` is true.
- \`routes\`: which sensor feeds MQTT or the API, and which rules it must pass first.
- \`mqtt\` and \`api\`: the destinations used with \`--send-mqtt\` and \`--send-api\`.

Environment variables override the destinations without editing the file:

| Variable | Overrides |
| --- | --- |
| \`MQTT_BROKER\` | The broker, as \`host:port\`. |
| \`API_URL\` | The API URL. Must start with http:// or https://. |

\`\`\`bash
MQTT_BROKER=localhost:1883 python simulator/simulator.py --send-mqtt --ticks 20
\`\`\`

No credentials are generated. If your broker or API needs authentication, supply it through your platform's secret store and never commit it.`);

  if (docker) {
    sections.push(`## Docker

\`Dockerfile\` builds the simulator as image \`${md(image)}\` and runs it as a non-root user. \`docker-compose.yml\` also starts a local Mosquitto broker that is reachable from this computer only (\`127.0.0.1:1883\`, anonymous access, for local development) and runs the simulator with \`--send-mqtt\`. It does not send API requests.

\`\`\`bash
docker compose up --build
\`\`\`

Container port ${md(docker.data.config.port)} comes from your Docker block. The simulator does not listen on any port.`);
  }

  if (k8s) {
    sections.push(`## Kubernetes

\`k8s/\` contains a namespace, a deployment (${md(k8s.data.config.replicas)} replica(s)) and a service for the image above. The manifests expect a broker at \`mosquitto:1883\` and do not deploy one. They also expect the image to be available to your cluster: build and push it to a registry you control first.

\`\`\`bash
kubectl apply -f k8s/
\`\`\``);
  }

  sections.push(`## Limitations

- The data is simulated; there is no hardware support.
- Only the first MQTT block and the first Cloud API block of the workflow are used.
- Each Logic rule is a single comparison.
- Delivery to MQTT or an API is best effort: errors are printed and the simulator keeps running.`);

  return sections.join('\n\n') + '\n';
}

export function generateProject(name: string, nodes: NexaNode[], edges: NexaEdge[]): GeneratedFile[] {
  const sensors = ofKind(nodes, 'sensor');
  const logic = ofKind(nodes, 'logic');
  const mqtt = ofKind(nodes, 'mqtt')[0];
  const api = ofKind(nodes, 'cloudApi')[0];
  const docker = ofKind(nodes, 'docker')[0];
  const k8s = ofKind(nodes, 'kubernetes')[0];

  const simConfig = {
    sensors: sensors.map((s) => ({
      id: s.id,
      name: s.data.label,
      ...s.data.config,
      min: num('sensor', 'min', s.data.config.min),
      max: num('sensor', 'max', s.data.config.max),
    })),
    rules: logic.map((l) => ({ id: l.id, name: l.data.label, ...l.data.config, threshold: num('logic', 'threshold', l.data.config.threshold) })),
    routes: computeRoutes(nodes, edges, mqtt, api),
    mqtt: mqtt ? { ...mqtt.data.config } : null,
    api: api ? { ...api.data.config } : null,
  };

  const image = String(docker?.data.config.image ?? 'nexa-forge/simulator:latest');
  const port = Number(docker?.data.config.port ?? 8080);
  const files: GeneratedFile[] = [
    { path: 'workflow.json', content: JSON.stringify(buildWorkflow(name, nodes, edges), null, 2) },
    { path: 'simulator/simulator.py', content: simulatorPy() },
    { path: 'simulator/config.json', content: JSON.stringify(simConfig, null, 2) + '\n' },
    { path: 'requirements.txt', content: REQUIREMENTS },
    { path: '.gitignore', content: '.venv/\n__pycache__/\n.env\n' },
  ];


  if (docker) {
    files.push({
      path: 'Dockerfile',
      content: `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY simulator/ ./simulator/
RUN useradd --create-home --uid 10001 nexa
USER nexa
CMD ["python", "-u", "simulator/simulator.py"]
`,
    });
    files.push({
      path: 'docker-compose.yml',
      content: `services:
  mosquitto:
    image: eclipse-mosquitto:2
    command: mosquitto -c /mosquitto-no-auth.conf
    ports:
      - "127.0.0.1:1883:1883" # local development only: anonymous access, not exposed to the network
  simulator:
    build: .
    image: ${yamlString(image)}
    command: ["python", "-u", "simulator/simulator.py", "--send-mqtt"] # publishes to the local broker above; no API requests
    environment:
      MQTT_BROKER: mosquitto:1883
    depends_on:
      - mosquitto
`,
    });
  }

  if (k8s) {
    const deploy = slugify(String(k8s.data.config.deploymentName), 'nexa-simulator');
    const ns = slugify(String(k8s.data.config.namespace), 'nexa');
    const replicas = Number(k8s.data.config.replicas) || 1;
    files.push({
      path: 'k8s/namespace.yaml',
      content: `apiVersion: v1
kind: Namespace
metadata:
  name: ${yamlString(ns)}
`,
    });
    files.push({
      path: 'k8s/deployment.yaml',
      content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${yamlString(deploy)}
  namespace: ${yamlString(ns)}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${yamlString(deploy)}
  template:
    metadata:
      labels:
        app: ${yamlString(deploy)}
    spec:
      containers:
        - name: ${yamlString(deploy)}
          image: ${yamlString(image)}
          command: ["python", "-u", "simulator/simulator.py", "--send-mqtt"]
          ports:
            - containerPort: ${port} # placeholder from the Docker block; the simulator does not listen on a port
          env:
            - name: MQTT_BROKER
              value: "mosquitto:1883" # expects a broker at this address; these manifests do not deploy one
`,
    });
    files.push({
      path: 'k8s/service.yaml',
      content: `apiVersion: v1
kind: Service
metadata:
  name: ${yamlString(deploy)}
  namespace: ${yamlString(ns)}
spec:
  selector:
    app: ${yamlString(deploy)}
  ports:
    - port: ${port}
      targetPort: ${port}
`,
    });
  }

  files.push({ path: 'README.md', content: buildReadme({ name, nodes, edges, files, simConfig, mqtt, api, docker, k8s, image }) });
  return files;
}
