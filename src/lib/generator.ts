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

function simulatorPy(): string {
  return `"""NEXA Forge virtual sensor simulator (generated).

All sensor readings are simulated. No real hardware is accessed.
Settings live in config.json next to this file; nothing is executed from it.
"""
import json
import math
import os
import random
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
    if not cfg or mqtt is None:
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
        print(f"[mqtt] cannot connect to {broker}: {exc} (printing readings only)")
        return None
    client.loop_start()
    return client


def post_alert(payload):
    cfg = CONFIG["api"]
    if not cfg:
        return
    url = os.environ.get("API_URL", str(cfg["url"]))
    if not url.startswith(("http://", "https://")):
        print(f"[api] refusing non-http(s) URL: {url}")
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
        print(f"[api] request failed: {exc}")


def main():
    client = connect_mqtt()
    topic = CONFIG["mqtt"]["topic"] if CONFIG["mqtt"] else None
    rules = {rule["id"]: rule for rule in CONFIG["rules"]}
    tick = 0
    while True:
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
            if "mqtt" in open_targets and client and topic:
                client.publish(topic, json.dumps(payload), qos=int(number(CONFIG["mqtt"].get("qos", 0))))
            if "api" in open_targets:
                post_alert(payload)
        time.sleep(1)


if __name__ == "__main__":
    main()
`;
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
    { path: 'requirements.txt', content: 'paho-mqtt>=2.0\n' },
  ];

  const run: string[] = ['pip install -r requirements.txt', 'python simulator/simulator.py'];

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
    environment:
      MQTT_BROKER: mosquitto:1883
    depends_on:
      - mosquitto
`,
    });
    run.push('docker compose up --build');
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
    run.push(`kubectl apply -f k8s/`);
  }

  files.push({
    path: 'README.md',
    content: `# ${name}

Generated by NEXA Forge (early-stage developer preview) on ${new Date().toISOString()}.

## Status
- Sensor readings are **simulated**. No real hardware or sensors are involved.
- This is a starter template. It has not been security-reviewed or tested against a production broker, registry or cluster. Review every file before using it anywhere real.
- No credentials are generated. If your MQTT broker or API needs authentication, supply it through environment variables or your platform's secret store. Never commit secrets.

## Contents
${files.map((f) => `- \`${f.path}\``).join('\n')}

## Run
\`\`\`bash
${run.join('\n')}
\`\`\`

The simulator prints one JSON reading per sensor every second. If an MQTT broker is reachable it also
publishes to the configured topic, and threshold rules POST alerts to the configured Cloud API endpoint.
Settings are read from \`simulator/config.json\`. \`MQTT_BROKER\` and \`API_URL\` environment variables override the broker and endpoint.
`,
  });
  return files;
}
