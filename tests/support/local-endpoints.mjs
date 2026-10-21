import { spawnSync } from "node:child_process";
import net from "node:net";

const DEFAULTS = {
  api: { name: "API", variable: "API_URL", value: "http://localhost:18080" },
  web: { name: "web", variable: "WEB_URL", value: "http://localhost:3000" },
  s3: { name: "object storage", variable: "S3_ENDPOINT", value: "http://localhost:19000" },
  database: {
    name: "SQL database",
    variable: "DATABASE_URL",
    value: "postgres://spaartrack:***@localhost:55432/spaartrack",
  },
};

function configured(key) {
  const definition = DEFAULTS[key];
  if (!definition) throw new Error(`Unknown local endpoint: ${key}`);
  return {
    name: definition.name,
    url: process.env[definition.variable] || definition.value,
    override: definition.variable,
  };
}

export const apiUrl = configured("api").url;
export const webUrl = configured("web").url;
export const s3Endpoint = configured("s3").url;
export const databaseUrl = process.env.PRIVACY_TEST_DATABASE_URL || configured("database").url;

export function endpointConfiguration(key) {
  return configured(key);
}

function composeListeners() {
  const compose = spawnSync("docker", ["compose", "ls"], { encoding: "utf8", timeout: 5_000 });
  const containers = spawnSync(
    "docker",
    ["ps", "--filter", "label=com.docker.compose.project", "--format", "{{.Label \"com.docker.compose.project\"}} {{.Names}} {{.Ports}}"],
    { encoding: "utf8", timeout: 5_000 }
  );
  return [compose.stdout, containers.stdout].filter(Boolean).join("\n").trim() || "unavailable (Docker inspection failed or no Compose containers are running)";
}

function endpointError(configuration, detail) {
  return new Error(
    `[LOCAL_ENDPOINT_UNREACHABLE] ${configuration.name} endpoint is unreachable. ` +
      `Resolved URL: ${configuration.url}. Override with ${configuration.override}. ` +
      `Expected stack may be displaced; Compose listeners / project / ports:\n${composeListeners()}\n` +
      `Probe detail: ${detail}`
  );
}

async function probeHttp(configuration, path = "/health/live") {
  try {
    await fetch(new URL(path, configuration.url), { signal: AbortSignal.timeout(2_000) });
  } catch (error) {
    throw endpointError(configuration, error instanceof Error ? error.message : String(error));
  }
}

function probeTcp(configuration) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(configuration.url);
    const socket = net.createConnection({ host: parsed.hostname, port: Number(parsed.port) || 5432 });
    const timeout = setTimeout(() => socket.destroy(new Error("timeout")), 2_000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(endpointError(configuration, error.message));
    });
  });
}

export async function assertExpectedStackReachable(keys = ["api", "web", "s3", "database"]) {
  for (const key of keys) {
    const configuration = endpointConfiguration(key);
    if (key === "database") await probeTcp(configuration);
    else if (key === "s3") await probeHttp(configuration, "/");
    else await probeHttp(configuration);
  }
}
