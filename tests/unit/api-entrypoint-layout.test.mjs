import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// ISSUE-13 (roadmap, 20 oktober 2026) bleek geen defect in apps/api/package.json:
// de `start`-script verwijst AL naar het pad dat de build oplevert. Deze test is daarom
// geen "fix"-test maar een regressieguard.
//
// De guard leest NIET apps/api/dist/ als waarheid: die map is gitignored build-output
// (.gitignore:5 `dist/`) en kan een oude, verouderde build-layout bevatten. In een
// verse checkout is apps/api/dist/ helemaal niet aanwezig. De verwachte layout wordt
// daarom afgeleid uit een verse compile van de huidige bronnen.
//
// De valkuil: apps/api/tsconfig.json zet geen `rootDir`. TypeScript leidt die af uit
// de import-graph. Doordat apps/api/src/broker-security.ts en broker-sync.ts
// ../../../packages/integration-contracts/src/trading212.js importeren, wordt de
// gemeenschappelijke bronroot de repo-root en wordt de uitvoer dist/apps/api/src/index.js.
// De ouderwetse dist/index.js bestaat daarom niet in een verse build.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const API_DIR = join(ROOT, "apps", "api");
const TESTS_DIR = join(ROOT, "tests");
const README_PATH = join(TESTS_DIR, "README.md");

const TRACE_ID = process.env.TRACE_ID ?? "unset";
const CORRELATION_ID = process.env.CORRELATION_ID ?? "unset";

const posix = (value) => value.split(sep).join("/");
const relFrom = (base, absolute) => posix(relative(base, absolute));

// ---------------------------------------------------------------------------
// Verse build van de API-pakketbron: compileert de huidige bronnen in het geheugen.
// `program.emit` met een eigen writeFile-callback schrijft niets naar schijf; de
// callback vangt de paden op die de compiler daadwerkelijk zou wegschrijven.
// ---------------------------------------------------------------------------
function compileApiPackage() {
  const configPath = join(API_DIR, "tsconfig.json");
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    },
  });
  assert.ok(parsed, "apps/api/tsconfig.json must be a parseable tsconfig");

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const emitted = [];
  program.emit(undefined, (fileName, _text, _byteOrderMark, _onError, sourceFiles) => {
    emitted.push({ file: fileName, sources: (sourceFiles ?? []).map((source) => source.fileName) });
  });
  return { parsed, emitted };
}

const { parsed, emitted } = compileApiPackage();

const EMITTED_ABS = new Set(emitted.map((entry) => entry.file));
const EMITTED_FROM_API = new Set(emitted.map((entry) => relFrom(API_DIR, entry.file)));

// De entrypoint-bron: de bronmodule waarvan de gebouwde server draait.
const ENTRY_SOURCE = resolve(API_DIR, "src", "index.ts");
const ENTRY_OUTPUTS = emitted
  .filter((entry) => entry.sources.some((source) => resolve(source) === ENTRY_SOURCE))
  .map((entry) => entry.file);
const ENTRY_JS = ENTRY_OUTPUTS.find((file) => file.endsWith(".js"));

const packageJson = JSON.parse(readFileSync(join(API_DIR, "package.json"), "utf8"));
const startScript = packageJson.scripts.start;

// De "node <pad>"-vorm van het start-script ontleden tot het doelpad.
const startTokens = String(startScript).trim().split(/\s+/);
const startTarget = startTokens.filter((token) => token.endsWith(".js")).at(-1);
assert.ok(startTarget, `apps/api/package.json scripts.start must contain a .js target, got: ${startScript}`);

const dockerfile = readFileSync(join(API_DIR, "Dockerfile"), "utf8");

// De Dockerfile heeft een build-stage en een runtime-stage. De CMD, de WORKDIR en de
// COPY --from=build horen bij de runtime-stage; de COPY-bron verwijst naar de build-stage.
const stages = dockerfile.split(/^FROM\s+/m).slice(1);
assert.ok(stages.length >= 2, "apps/api/Dockerfile must have a build stage and a runtime stage");
const buildStage = stages[0];
const runtimeStage = stages[stages.length - 1];

const workdirOf = (stage) => stage.match(/^WORKDIR\s+(\S+)/m)?.[1];
const buildWorkdir = workdirOf(buildStage);
const runtimeWorkdir = workdirOf(runtimeStage);
assert.ok(buildWorkdir, "the Dockerfile build stage must declare a WORKDIR");
assert.ok(runtimeWorkdir, "the Dockerfile runtime stage must declare a WORKDIR");

const cmdMatch = runtimeStage.match(/^CMD\s+\["node",\s*"([^"]+)"\]/m);
assert.ok(cmdMatch, "apps/api/Dockerfile must declare a CMD [\"node\", \"<path>\"]");
const dockerCmdTarget = cmdMatch[1];

const copyMatch = runtimeStage.match(/^COPY\s+--from=build\s+(\S+)\s+(\S+)/m);
assert.ok(copyMatch, "apps/api/Dockerfile must COPY the build output into the runtime image");
const copySource = copyMatch[1];
const copyDestination = copyMatch[2];

// ---------------------------------------------------------------------------
// Helper: matcht een start-doelpad tegen de verse build-output.
// Dit is de kern van de guard én wordt gebruikt als negatieve controle.
// ---------------------------------------------------------------------------
function resolvesToEmittedEntry(target, apiDir = API_DIR) {
  const absolute = resolve(apiDir, target);
  if (!EMITTED_ABS.has(absolute)) return { ok: false, reason: `not emitted by a fresh build: ${absolute}` };
  const fromApi = relFrom(apiDir, absolute);
  if (fromApi !== relFrom(apiDir, ENTRY_JS)) {
    return { ok: false, reason: `emitted, but is not the API entrypoint (${relFrom(apiDir, ENTRY_JS)})` };
  }
  return { ok: true, reason: "emitted by a fresh build" };
}

test("TC-US-0105-A: the API start script resolves to the file a fresh build actually emits", (t) => {
  t.diagnostic(`TRACE_ID=${TRACE_ID} CORRELATION_ID=${CORRELATION_ID}`);

  assert.ok(ENTRY_JS, "the API entry source apps/api/src/index.ts must emit a .js file");
  assert.equal(
    relFrom(API_DIR, ENTRY_JS),
    startTarget,
    `apps/api/package.json scripts.start must point at the path a fresh build emits (${relFrom(API_DIR, ENTRY_JS)})`,
  );

  const verdict = resolvesToEmittedEntry(startTarget);
  assert.ok(verdict.ok, `scripts.start target must exist in a fresh build: ${verdict.reason}`);
});

test("TC-US-0105-A: a fresh build does not emit dist/index.js at the API package root", () => {
  const legacyPath = "dist/index.js";
  assert.equal(
    EMITTED_FROM_API.has(legacyPath),
    false,
    `a fresh build must not emit ${legacyPath}; the emitted layout is ${[...EMITTED_FROM_API].filter((p) => p.endsWith("index.js")).join(", ")}`,
  );
  assert.equal(
    resolvesToEmittedEntry(legacyPath).ok,
    false,
    "the guard must reject the pre-Trading212 dist/index.js path, otherwise it cannot detect that drift",
  );
});

test("TC-US-0105-A: the emitted layout is rooted at the repo root because of the cross-package import", () => {
  const crossPackageOutputs = [...EMITTED_FROM_API].filter((path) => path.startsWith("dist/packages/"));
  assert.ok(
    crossPackageOutputs.length > 0,
    "the compile must pull packages/integration-contracts into the program, otherwise the inferred rootDir is apps/api/src",
  );
  assert.ok(
    EMITTED_FROM_API.has("dist/apps/api/src/index.js"),
    "the emitted entrypoint must be dist/apps/api/src/index.js relative to apps/api",
  );
});

test("TC-US-0105-A: the Dockerfile CMD starts the same emitted entrypoint as the start script", () => {
  assert.equal(
    dockerCmdTarget,
    startTarget,
    "apps/api/Dockerfile CMD and apps/api/package.json scripts.start must reference the same emitted path",
  );

  // De container kopieert de inhoud van de build-output naar ./dist. De CMD verwijst dus
  // naar <container-dist>/<pad binnen de build-output>. Vertal dat CMD-pad terug naar het
  // lokale build-pad en controleer dat dit bestand echt is uitgestuurd.
  const containerDist = resolve(runtimeWorkdir, copyDestination);
  const containerFile = resolve(runtimeWorkdir, dockerCmdTarget);
  const insideDist = relative(containerDist, containerFile);
  assert.ok(
    !insideDist.startsWith(".."),
    `the Dockerfile CMD must point inside the copied build output, got ${insideDist}`,
  );

  // De COPY-bron moet de outDir van de API-build zijn.
  assert.equal(
    relative(buildWorkdir, copySource),
    relFrom(ROOT, parsed.options.outDir),
    "the Dockerfile must COPY the API build output directory (apps/api/dist)",
  );

  const buildFile = resolve(parsed.options.outDir, insideDist);
  assert.ok(
    EMITTED_ABS.has(buildFile),
    `the Dockerfile CMD must start a file a fresh build emits; ${buildFile} is not emitted`,
  );
});

test("TC-US-0105-A: the guard is sensitive to start-script drift", () => {
  // Negatieve controle: als iemand het start-script terugzet op het oude pad, moet de
  // guard dat detecteren in plaats van stil te passeren.
  const drifted = resolvesToEmittedEntry("dist/index.js");
  assert.equal(drifted.ok, false, "the guard must fail on the pre-Trading212 dist/index.js target");
});

// ---------------------------------------------------------------------------
// ISSUE-14: tests/README.md documenteert vier mappen die niet bestaan.
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(["node_modules", ".git", ".worktrees", "dist", "coverage", ".turbo", "tmp", "data", "backups"]);

function listRepoFiles(dir = ROOT, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listRepoFiles(full, acc);
    else acc.push(relFrom(ROOT, full));
  }
  return acc;
}

const REPO_FILES = listRepoFiles();
const REPO_TOP_DIRS = new Set(
  readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !SKIP_DIRS.has(entry.name))
    .map((entry) => entry.name),
);

const README_TEXT = readFileSync(README_PATH, "utf8");
const README_LINES = README_TEXT.split(/\r?\n/);

// Map-/padverwijzingen uit de README halen. Een token is een pad dat met "/" eindigt.
// Alleen lowercase-paden tellen als mapverwijzing; daarmee vallen prose-afkortingen
// zoals "UX/UI-contracten" weg, terwijl expliciet geschreven paden wel meetellen.
const DIR_TOKEN = /(?<=^|[\s`(|>-])((?:[A-Za-z0-9_.-]+\/)+)/gm;
const BACKTICKED = /`([^`\n]+)`/g;

function readmeDirTokens() {
  const tokens = new Map();
  for (const match of README_TEXT.matchAll(DIR_TOKEN)) {
    const token = match[1];
    if (!/^[a-z0-9][a-z0-9_.\/-]*\/$/.test(token)) continue;
    if (!tokens.has(token)) tokens.set(token, []);
    tokens.get(token).push(README_LINES.findIndex((line) => line.includes(token)) + 1);
  }
  return tokens;
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

const REAL_TEST_DIRS = readdirSync(TESTS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `tests/${entry.name}/`)
  .sort();

const PHANTOM_LAYERS = ["contract", "integration", "e2e", "financial-golden"];

test("ISSUE-14: tests/README.md documents exactly the test directories that exist", () => {
  // De container "tests/" zelf telt niet mee; het gaat om de lagen eronder.
  const documented = [...readmeDirTokens().keys()].filter((token) => /^tests\/[^/]+\/$/.test(token)).sort();
  assert.deepEqual(
    documented,
    REAL_TEST_DIRS,
    "tests/README.md must document exactly the existing test directories, no more and no less",
  );
});

test("ISSUE-14: every directory named in tests/README.md exists on disk", () => {
  for (const [token, lines] of readmeDirTokens()) {
    const absolute = join(ROOT, token);
    if (token.startsWith("tests/")) {
      assert.ok(existsSync(absolute) && statSync(absolute).isDirectory(), `${token} (README line ${lines[0]}) must exist as a directory`);
      continue;
    }
    const isDocumentedPhantom = PHANTOM_LAYERS.some((layer) => token === `${layer}/`);
    assert.ok(
      isDocumentedPhantom || (existsSync(absolute) && statSync(absolute).isDirectory()),
      `${token} (README line ${lines[0]}) must exist as a directory or be one of the documented replaced layers`,
    );
  }
});

test("ISSUE-14: the four replaced test layers are mapped to real covering paths", () => {
  const tokens = readmeDirTokens();
  for (const layer of PHANTOM_LAYERS) {
    const token = `${layer}/`;
    assert.ok(tokens.has(token), `tests/README.md must still name the replaced layer ${token} and map it to its current location`);

    const lines = README_LINES.filter((line) => line.includes(token));
    const covering = [...lines.join("\n").matchAll(BACKTICKED)]
      .map((match) => match[1])
      .filter((value) => value.startsWith("tests/") && !value.endsWith("/"));
    assert.ok(covering.length > 0, `the replaced layer ${token} must map to at least one existing path under tests/`);

    for (const path of covering) {
      const absolute = join(ROOT, path);
      if (path.includes("*")) {
        const matcher = globToRegExp(path);
        assert.ok(
          REPO_FILES.some((file) => matcher.test(file)),
          `the covering path ${path} for ${token} must match at least one file on disk`,
        );
        continue;
      }
      assert.ok(existsSync(absolute), `the covering path ${path} for ${token} must exist on disk`);
    }
  }
});

test("ISSUE-14: the replaced layers themselves no longer exist on disk", () => {
  for (const layer of PHANTOM_LAYERS) {
    const absolute = join(TESTS_DIR, layer);
    assert.equal(
      existsSync(absolute),
      false,
      `tests/${layer} must not exist; if it is created, tests/README.md must be updated to document it as a real layer`,
    );
  }
});

test("ISSUE-14: every path cited in tests/README.md resolves on disk", () => {
  for (const match of README_TEXT.matchAll(BACKTICKED)) {
    const cited = match[1];
    if (!cited.includes("/")) continue;
    const first = cited.split("/")[0];
    if (!REPO_TOP_DIRS.has(first)) continue;
    if (cited.includes("*")) {
      const matcher = globToRegExp(cited);
      assert.ok(
        REPO_FILES.some((file) => matcher.test(file)),
        `tests/README.md cites ${cited}, which matches no file on disk`,
      );
      continue;
    }
    assert.ok(existsSync(join(ROOT, cited)), `tests/README.md cites ${cited}, which does not exist on disk`);
  }
});
