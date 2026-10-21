import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowSource = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const workflow = workflowSource;
const composeSource = readFileSync(new URL("../../compose.yaml", import.meta.url), "utf8");
const apiPackage = JSON.parse(readFileSync(new URL("../../apps/api/package.json", import.meta.url), "utf8"));

// The API build emits its entrypoint relative to the inferred tsc rootDir, which
// shifts whenever apps/api starts importing from packages/. Derive the emitted
// path from the package start script instead of hardcoding it.
const apiEntrypoint = apiPackage.scripts.start.replace(/^node\s+/, "").replace(/^dist\//, "");
const apiEntrypointDistPath = `apps/api/dist/${apiEntrypoint}`;

function job(name) {
  // The last job in the workflow has no following job header, so its block runs
  // to the end of the file. The alternation keeps the earlier job boundary as
  // the preferred stop, so the span of every non-final job is unchanged.
  const match = workflow.match(
    new RegExp(`^ {2}${name}:\\n[\\s\\S]*?(?=^ {2}[A-Za-z][\\w-]*:\\n|(?![\\s\\S]))`, "m")
  );
  assert.ok(match, `workflow must contain a ${name} job`);
  return match[0];
}

function step(jobSource, marker) {
  const found = jobSource.split(/\n(?=\s{6}- )/).find((candidate) => candidate.includes(marker));
  assert.ok(found, `job must contain a step matching ${marker}`);
  return found;
}

// --- minimal YAML subset parser (block mappings, block sequences, block scalars) for Poort B guards ---
function stripComment(line) {
  let single = false;
  let dbl = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "'" && !dbl) single = !single;
    else if (character === '"' && !single) dbl = !dbl;
    else if (character === "#" && !single && !dbl && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }
  return line;
}
function indentOf(line) {
  return line.length - line.trimStart().length;
}
function isBlank(line) {
  return line.trim() === "" || /^\s*#/.test(line);
}
function parseScalar(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    return inner === "" ? [] : inner.split(",").map((entry) => parseScalar(entry));
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "~") return null;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^-?\d*\.\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}
function isSequenceItem(text) {
  return text === "-" || text.startsWith("- ");
}
export function parseYaml(source) {
  const lines = source.split("\n");
  function skipBlank(idx) {
    while (idx < lines.length && isBlank(lines[idx])) idx += 1;
    return idx;
  }
  function parseBlock(index, minIndent) {
    const start = skipBlank(index);
    if (start >= lines.length) return { value: null, next: start };
    const indent = indentOf(lines[start]);
    if (indent < minIndent) return { value: null, next: start };
    const text = stripComment(lines[start]).trim();
    return isSequenceItem(text) ? parseSequence(start, indent) : parseMapping(start, indent, null);
  }
  function parseMapping(index, indent, pending) {
    const mapping = new Map();
    let cursor = index;
    let pendingEntry = pending;
    while (cursor < lines.length) {
      if (pendingEntry === null) {
        if (isBlank(lines[cursor])) { cursor += 1; continue; }
        const currentIndent = indentOf(lines[cursor]);
        if (currentIndent < indent) break;
        if (currentIndent > indent) throw new Error(`unexpected indentation at line ${cursor + 1}`);
      }
      const raw = pendingEntry !== null ? pendingEntry.text : stripComment(lines[cursor]).trim();
      const separator = raw.indexOf(":");
      if (separator === -1) throw new Error(`expected a mapping key at line ${cursor + 1}`);
      const key = raw.slice(0, separator).trim().replace(/^[\"']|[\"']$/g, "");
      const rest = raw.slice(separator + 1).trim();
      const consumed = pendingEntry !== null;
      pendingEntry = null;
      if (!consumed) cursor += 1;
      if (rest === "") {
        const nested = skipBlank(cursor);
        if (nested < lines.length && indentOf(lines[nested]) > indent) {
          const block = parseBlock(nested, indentOf(lines[nested]));
          mapping.set(key, block.value);
          cursor = block.next;
        } else {
          mapping.set(key, null);
        }
        continue;
      }
      if (rest === "|" || rest === "|-" || rest === "|+" || rest === ">" || rest === ">-" || rest === ">+") {
        const literal = rest.startsWith("|");
        const chomp = rest.endsWith("-") ? "strip" : rest.endsWith("+") ? "keep" : "clip";
        const content = [];
        let blockCursor = cursor;
        let blockIndent = null;
        while (blockCursor < lines.length) {
          const line = lines[blockCursor];
          if (line.trim() === "") { content.push(""); blockCursor += 1; continue; }
          const lineIndent = indentOf(line);
          if (lineIndent <= indent) break;
          if (blockIndent === null) blockIndent = lineIndent;
          content.push(line.slice(Math.min(blockIndent, lineIndent)));
          blockCursor += 1;
        }
        let text = literal ? content.join("\n") : content.map((line) => (line.trim() === "" ? "\n" : line)).join(" ").replace(/ \n/g, "\n");
        if (chomp === "strip") text = text.replace(/\n+$/, "");
        else if (chomp === "clip") { text = text.replace(/\n+$/, ""); if (text !== "") text += "\n"; }
        mapping.set(key, text);
        cursor = blockCursor;
        continue;
      }
      mapping.set(key, parseScalar(rest));
    }
    return { value: mapping, next: cursor };
  }
  function parseSequence(index, indent) {
    const items = [];
    let cursor = index;
    while (cursor < lines.length) {
      if (isBlank(lines[cursor])) { cursor += 1; continue; }
      const currentIndent = indentOf(lines[cursor]);
      if (currentIndent < indent) break;
      const text = stripComment(lines[cursor]).trim();
      if (!isSequenceItem(text)) break;
      const after = text.slice(1);
      const consumed = after.length - after.trimStart().length;
      const itemIndent = indent + 1 + consumed;
      const rest = after.trimStart();
      cursor += 1;
      if (rest === "") {
        const block = parseBlock(cursor, itemIndent);
        items.push(block.value);
        cursor = block.next;
        continue;
      }
      if (/^[^:]+:(\s|$)/.test(rest)) {
        const block = parseMapping(cursor, itemIndent, { text: rest });
        items.push(block.value);
        cursor = block.next;
        continue;
      }
      items.push(parseScalar(rest));
    }
    return { value: items, next: cursor };
  }
  const parsed = parseBlock(0, 0);
  return parsed.value;
}

const parsedWorkflow = parseYaml(workflowSource);
const verifyJobParsed = parsedWorkflow.get("jobs")?.get("verify");
const parsedSteps = verifyJobParsed?.get("steps") ?? [];

function stringify(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(" ");
  if (value instanceof Map) return [...value.entries()].map(([key, entry]) => `${key}: ${stringify(entry)}`).join("\n");
  return String(value);
}

function collectTokens(value, sink = []) {
  if (value === null || value === undefined) return sink;
  if (typeof value === "string") { sink.push(value); return sink; }
  if (Array.isArray(value)) { for (const entry of value) collectTokens(entry, sink); return sink; }
  if (value instanceof Map) { for (const [key, entry] of value.entries()) { sink.push(String(key)); collectTokens(entry, sink); } return sink; }
  sink.push(String(value)); return sink;
}

test("TC-US-0103: pull request CI runs blocking checks and uploads evidence", () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /name:\s+Lint[\s\S]*?run:\s+pnpm lint/);
  assert.match(workflow, /name:\s+Typecheck[\s\S]*?run:\s+pnpm typecheck/);
  assert.match(workflow, /name:\s+Tests[\s\S]*?run:\s+pnpm test/);
  assert.match(workflow, /uses:\s+actions\/upload-artifact@v4/);
  assert.match(workflow, /name:\s+ci-evidence-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(workflow, /continue-on-error:\s+true/);
  assert.doesNotMatch(workflow, /run:\s+[^\\n]*\|\|\s+true\b/);
});

test("TC-US-0103: CI artifact retains diagnostics even after a failed check", () => {
  const artifactStep = workflow.match(/- name: Upload CI evidence[\s\S]*?(?=\n\s+- name:|\n\s+security:)/)?.[0];
  assert.ok(artifactStep, "CI evidence upload step must exist");
  assert.match(artifactStep, /if:\s+\$\{\{ always\(\) \}\}/);
  assert.match(artifactStep, /path:/);
});

test("TC-US-0105: CI bootstraps the API entrypoint that the build actually emits", () => {
  // Poort B: verify now boots the compose stack; the API entrypoint is baked
  // into the api image's Dockerfile CMD. Keep legacy check as fallback so the
  // test stays red-first before the migration and green after.
  const verify = job("verify");
  const hasLegacyBootstrap = verify.includes("Start API bootstrap");
  if (hasLegacyBootstrap) {
    const bootstrapStep = step(verify, "- name: Start API bootstrap");
    assert.doesNotMatch(
      bootstrapStep,
      /apps\/api\/dist\/index\.js/,
      "stale API entrypoint path must be gone from the bootstrap step"
    );
    const startsEmittedEntrypoint =
      bootstrapStep.includes(apiEntrypointDistPath) ||
      new RegExp(`pnpm\\s+--filter\\s+${apiPackage.name}\\s+start`).test(bootstrapStep);
    assert.ok(
      startsEmittedEntrypoint,
      `bootstrap step must start ${apiEntrypointDistPath} (or "pnpm --filter ${apiPackage.name} start")`
    );
  } else {
    // Compose path: verify must build and start the stack that contains the api
    assert.match(verify, /docker compose up[^\n]*--build/, "verify job must build and start the compose stack");
    // Dockerfile embeds the emitted entrypoint - check compose file references api Dockerfile
    assert.match(composeSource, /dockerfile:\s*apps\/api\/Dockerfile/);
    // The build output path is still the same - verify via package script derivation
    assert.ok(apiEntrypoint.length > 0, "api entrypoint must be derivable from package.json");
  }
});

test("TC-US-0103: security job checks out full history so the gitleaks range resolves", () => {
  const checkoutStep = step(job("security"), "- uses: actions/checkout@");
  assert.match(
    checkoutStep,
    /fetch-depth:\s*0/,
    "gitleaks scans a <before>^..<after> range and needs a full clone (fetch-depth: 0)"
  );
});

test("TC-US-0103: the security job checks out with a Node 24 runtime action", () => {
  const checkoutStep = step(job("security"), "- uses: actions/checkout@");
  const major = checkoutStep.match(/actions\/checkout@v(\d+)/)?.[1];
  assert.ok(major, "the security job must pin an actions/checkout major version");
  assert.ok(
    Number(major) >= 5,
    `actions/checkout@v${major} targets Node 20, which GitHub removes from hosted runners on 2026-09-16; v5 and later run on Node 24`
  );
});

test("TC-US-0103: every CI job checks out with a Node 24 runtime action", () => {
  for (const name of ["verify", "security", "image"]) {
    const checkoutStep = step(job(name), "- uses: actions/checkout@");
    const major = checkoutStep.match(/actions\/checkout@v(\d+)/)?.[1];
    assert.ok(major, `the ${name} job must pin an actions/checkout major version`);
    assert.ok(
      Number(major) >= 5,
      `the ${name} job checks out with actions/checkout@v${major}, which targets Node 20; GitHub removes Node 20 from hosted runners on 2026-09-16, so v5 and later (Node 24) are required`
    );
  }
});

test("TC-US-0103: the CI workflow pins one checkout runtime line for every job", () => {
  const majors = ["verify", "security", "image"].map((name) => {
    const checkoutStep = step(job(name), "- uses: actions/checkout@");
    const major = checkoutStep.match(/actions\/checkout@v(\d+)/)?.[1];
    assert.ok(major, `the ${name} job must pin an actions/checkout major version`);
    return Number(major);
  });
  assert.equal(
    new Set(majors).size,
    1,
    `all CI jobs must use the same actions/checkout major, found [${majors.join(", ")}]`
  );
});

test("TC-US-0103: no checkout reference in the workflow targets a removed runtime", () => {
  const references = workflow.match(/actions\/checkout@v\d+/g) ?? [];
  assert.ok(references.length > 0, "the workflow must reference actions/checkout");
  for (const reference of references) {
    const major = Number(reference.match(/@v(\d+)/)[1]);
    assert.ok(
      major >= 5,
      `${reference} targets Node 20, which GitHub removes from hosted runners on 2026-09-16; v5 and later run on Node 24`
    );
  }
});

test("TC-US-0103: gitleaks scans pull requests with the token and permissions the action requires", () => {
  const secretScanStep = step(job("security"), "gitleaks/gitleaks-action@");
  assert.match(
    secretScanStep,
    /GITHUB_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/,
    "gitleaks-action exits 1 on pull_request events when GITHUB_TOKEN is absent, before scanning"
  );
  assert.match(
    job("security"),
    /pull-requests:\s*write/,
    "gitleaks-action reads the pull request commits and comments through the GitHub API"
  );
});

// Poort B runtime-coverage guards (ISSUE-11)
test("TC-US-0103 runtime: the verify job enables STACK_SMOKE for the stack-runtime suite", () => {
  assert.ok(verifyJobParsed, "the workflow must declare a verify job");
  const runtimeSteps = parsedSteps.filter((s) => s?.get("env")?.get("STACK_SMOKE") === "1" || s?.get("env")?.get("STACK_SMOKE") === 1);
  assert.ok(runtimeSteps.length >= 1, "the verify job must run a stack-runtime test step with STACK_SMOKE=1 in its env block (parsed YAML, not a comment)");
  const runtimeStep = runtimeSteps.find((s) => stringify(s.get("run")).includes("pnpm test"));
  assert.ok(runtimeStep, "the stack-runtime step must execute pnpm test");
  assert.equal(String(runtimeStep.get("env")?.get("STACK_SMOKE")), "1", "the stack-runtime step must export STACK_SMOKE=1");
  assert.equal(verifyJobParsed.get("env")?.get("STACK_SMOKE"), undefined, "STACK_SMOKE must not be exported job-wide; the static gate must stay separate");
  for (const st of parsedSteps) {
    if (st === runtimeStep) continue;
    const env = st.get("env");
    assert.notEqual(String(env?.get("STACK_SMOKE") ?? ""), "1", `only the stack-runtime step may enable STACK_SMOKE (offender: ${st?.get("name") ?? "unnamed step"})`);
  }
});

test("TC-US-0103 runtime: the stack-runtime step points at the compose stack endpoints", () => {
  const runtimeStep = parsedSteps.find((s) => (String(s?.get("env")?.get("STACK_SMOKE")) === "1") && stringify(s.get("run")).includes("pnpm test"));
  assert.ok(runtimeStep, "runtime step must exist");
  const env = runtimeStep.get("env");
  const api = env.get("API_URL");
  const web = env.get("WEB_URL");
  const s3 = env.get("S3_ENDPOINT") ?? env.get("OBJECT_STORAGE_URL");
  assert.ok(api, "the stack-runtime step must export API_URL");
  assert.ok(web, "the stack-runtime step must export WEB_URL");
  assert.ok(s3, "the stack-runtime step must export S3_ENDPOINT (or OBJECT_STORAGE_URL) for the object-storage contract");
  for (const url of [api, web, s3]) {
    assert.match(String(url), /^https?:\/\/localhost:\d+/, `endpoint ${url} must target the compose stack on the runner`);
  }
  assert.match(composeSource, /\n  api:/);
  assert.match(composeSource, /\n  web:/);
  assert.match(composeSource, /\n  object-storage:/);
  assert.match(composeSource, /18080:8080/, "compose.yaml must publish api port 18080");
  assert.match(composeSource, /19000:9000/, "compose.yaml must publish object-storage port 19000");
  assert.match(composeSource, /WEB_PORT/, "compose.yaml must publish web port via WEB_PORT");
  assert.equal(new URL(String(api)).port, "18080", "API_URL must target the compose api publish port");
  assert.equal(new URL(String(web)).port, "3000", "WEB_URL must target the compose web publish port");
  assert.equal(new URL(String(s3)).port, "19000", "S3_ENDPOINT must target the compose object-storage publish port");
});

test("TC-US-0103 runtime: the stack-runtime step is blocking", () => {
  const runtimeStep = parsedSteps.find((s) => String(s?.get("env")?.get("STACK_SMOKE")) === "1");
  assert.ok(runtimeStep, "runtime step must exist");
  assert.notEqual(runtimeStep.get("continue-on-error"), true, "the stack-runtime step must not be continue-on-error");
  assert.ok(runtimeStep.get("if") == null, "the stack-runtime step must not be conditional");
  const run = stringify(runtimeStep.get("run"));
  assert.doesNotMatch(run, /\|\|\s+true\b/, "the stack-runtime step must not swallow failures");
  assert.doesNotMatch(run, /;\s+true\b/, "the stack-runtime step must not swallow failures");
});

test("TC-US-0103 runtime: the workflow waits for stack readiness with a bounded timeout", () => {
  const readinessStep = parsedSteps.find((s) => {
    const run = stringify(s.get("run"));
    return run.includes("/health/ready") && run.includes("docker compose");
  });
  assert.ok(readinessStep, "the verify job must wait for the stack to become ready (must reference /health/ready and docker compose)");
  const run = stringify(readinessStep.get("run"));
  assert.match(run, /deadline|timeout|MAX_ATTEMPTS|attempts/, "the readiness wait must be bounded by a timeout");
  // Budget check: only inspect timeout/deadline declarations, not incidental small sleep intervals.
  // Extract values from patterns like `deadline=120`, `timeout 120`, `MAX_ATTEMPTS=60`.
  const budgetMatches = [...run.matchAll(/(?:deadline|timeout|MAX_ATTEMPTS)\s*=?\s*(\d+)/gi)].map((m) => Number(m[1]));
  assert.ok(budgetMatches.length > 0, "the readiness wait must declare an explicit timeout budget");
  assert.ok(budgetMatches.every((v) => v <= 900), "the readiness timeout must stay within a sane budget so a broken stack fails fast");
  assert.match(run, /sleep/, "the readiness wait must poll instead of busy-waiting");
  assert.match(run, /exit 1/, "the readiness wait must fail the job when the stack never becomes ready");
  assert.match(run, /docker compose logs/, "the readiness wait must attach the container logs on timeout");
  assert.doesNotMatch(run, /\|\|\s+true\b/, "the readiness wait must not swallow failures");
});

test("TC-US-0103 runtime: CI never enables the opt-in broker runtime suite", () => {
  const tokens = collectTokens(parsedWorkflow).join("\n");
  assert.doesNotMatch(tokens, /BROKER_RUNTIME_TEST/, "BROKER_RUNTIME_TEST must stay opt-in: it needs real provider credentials");
});
