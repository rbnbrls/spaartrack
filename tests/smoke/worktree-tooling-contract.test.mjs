import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// US-0004 tooling: an isolated task worktree must be self-sufficient for the
// lint/typecheck gate. `git worktree add` produces a checkout without
// node_modules/ (gitignored), so `pnpm lint` / `pnpm typecheck` report a
// provisioning artifact (TS2307 on 'pg' plus the TS7006 cascade it triggers)
// instead of a source defect. This contract locks the wiring that makes the
// gate reflect the source.
//
// Static assertions only: this test never requires node_modules/ to exist, so it
// stays green in CI and in a bare checkout.

const ROOT = resolve(import.meta.dirname, "../..");
const BOOTSTRAP = "scripts/dev/worktree-bootstrap.sh";

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

// Minimal reader for the `importers:` block of pnpm-lock.yaml. The repo has no
// YAML dependency and must not gain one for a tooling contract, so the lockfile
// is read by indentation instead of by a parser.
function lockImporterBlock(lock, importer) {
  const lines = lock.split("\n");
  const start = lines.findIndex((line) => line === `  ${importer}:`);
  if (start === -1) return null;
  const block = [];
  for (const line of lines.slice(start + 1)) {
    // A new importer starts at two-space indent; a new top-level key has none.
    if (/^ {2}\S/.test(line) || /^\S/.test(line)) break;
    block.push(line);
  }
  return block.join("\n");
}

test("US-0103 tooling: pg and @types/pg are declared in apps/api, not at the root", () => {
  const apiPackage = JSON.parse(read("apps/api/package.json"));
  assert.equal(apiPackage.dependencies.pg, "^8.13.1", "apps/api must declare pg as a dependency");
  assert.equal(apiPackage.devDependencies["@types/pg"], "^8.11.10", "apps/api must declare @types/pg");
  assert.equal(apiPackage.dependencies["@types/pg"], undefined, "@types/pg belongs in devDependencies");
  assert.equal(apiPackage.devDependencies.pg, undefined, "pg belongs in dependencies");

  const rootPackage = JSON.parse(read("package.json"));
  assert.equal(rootPackage.dependencies?.pg, undefined, "pg must not be duplicated in the root package");
  assert.equal(rootPackage.devDependencies?.["@types/pg"], undefined, "@types/pg must not be duplicated at the root");
});

test("US-0103 tooling: pnpm-workspace.yaml includes apps/* so the api importer is a workspace package", () => {
  const workspace = read("pnpm-workspace.yaml");
  const patterns = workspace
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
  assert.ok(patterns.includes("apps/*"), `pnpm-workspace.yaml must include apps/* (got ${JSON.stringify(patterns)})`);
  assert.ok(patterns.includes("packages/*"), "pnpm-workspace.yaml must include packages/*");
});

test("US-0103 tooling: the pnpm-lock.yaml apps/api importer lists pg and @types/pg", () => {
  const lock = read("pnpm-lock.yaml");
  const block = lockImporterBlock(lock, "apps/api");
  assert.ok(block !== null, "pnpm-lock.yaml must contain an apps/api importer");
  assert.match(block, /^ {6}pg:$/m, "apps/api importer must list pg");
  assert.match(block, /^ {6}'@types\/pg':$/m, "apps/api importer must list @types/pg");
  assert.match(block, /^ {6}pg:\n {8}specifier: \^8\.13\.1$/m, "pg specifier must match apps/api/package.json");
  assert.match(block, /^ {6}'@types\/pg':\n {8}specifier: \^8\.11\.10$/m, "@types/pg specifier must match apps/api/package.json");
});

test("US-0004 tooling: the worktree provisioning helper exists and is executable", () => {
  const path = join(ROOT, BOOTSTRAP);
  assert.ok(existsSync(path), `${BOOTSTRAP} must exist so worktrees can be provisioned`);
  assert.ok(statSync(path).isFile(), `${BOOTSTRAP} must be a regular file`);
  const source = read(BOOTSTRAP);
  assert.match(source, /^#!.*\b(bash|sh)\b/m, `${BOOTSTRAP} must carry a shell shebang`);
  assert.match(source, /pnpm install --frozen-lockfile/, `${BOOTSTRAP} must provision with the same command CI runs`);
  assert.doesNotMatch(source, /--no-frozen-lockfile/, `${BOOTSTRAP} must never bypass the lockfile`);
});

test("US-0004 tooling: the helper is wired into the developer documentation", () => {
  // docs/development.md is the authoritative place. AGENTS.md is a protected
  // agent-instruction file, so it is only checked for CONSISTENCY: if it ever
  // mentions worktree provisioning it must point at the same script, never at a
  // drifted path.
  assert.ok(
    read("docs/development.md").includes(BOOTSTRAP),
    `docs/development.md must reference ${BOOTSTRAP} so the instruction cannot drift`
  );
  const agents = read("AGENTS.md");
  if (/worktree/i.test(agents) && /bootstrap/i.test(agents)) {
    assert.ok(
      agents.includes(BOOTSTRAP),
      `AGENTS.md mentions worktree bootstrap but must point at ${BOOTSTRAP}`
    );
  }
});

test("US-0004 tooling: the docs state an unambiguous way to report a typecheck failure", () => {
  const development = read("docs/development.md");
  assert.match(development, /--check/, "docs/development.md must document the --check provisioning probe");
  assert.match(
    development,
    /provisioning|provisioner/i,
    "docs/development.md must name the provisioning artifact so a tsc failure has one unambiguous cause"
  );
  assert.match(
    development,
    /TS2307|TS7006/,
    "docs/development.md must name the error codes of the provisioning artifact"
  );
});

test("US-0004 tooling: the helper cannot vendor node_modules into git", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /^node_modules\/$/m, "node_modules/ must stay gitignored");
  const source = read(BOOTSTRAP);
  assert.doesNotMatch(source, /git add .*node_modules/, "the helper must never stage node_modules");
  assert.doesNotMatch(source, /cp -R? .*node_modules/, "the helper must never copy node_modules into the checkout");
});

test("US-0004 tooling: the helper may not weaken the lint/typecheck gate", () => {
  const source = read(BOOTSTRAP);
  assert.doesNotMatch(source, /\|\|\s*true/, "the helper must not swallow failures");
  assert.doesNotMatch(source, /continue-on-error/, "the helper must not mark failures non-blocking");
  assert.doesNotMatch(source, /--no-verify/, "the helper must not skip verification");
  const development = read("docs/development.md");
  assert.doesNotMatch(development, /pnpm lint[^\n]*\|\|\s*true/, "the docs must not document a bypassing lint command");
});

test("US-0004 tooling: the helper proves it leaves the primary checkout untouched", () => {
  const source = read(BOOTSTRAP);
  assert.match(source, /fingerprint/i, `${BOOTSTRAP} must fingerprint the primary node_modules before and after`);
  assert.match(source, /--frozen-lockfile/, `${BOOTSTRAP} must provision with a frozen lockfile`);
  assert.match(source, /node_modules/, `${BOOTSTRAP} must reason about node_modules explicitly`);
});

test("US-0004 tooling: the fingerprint covers symlinks, not only regular files", () => {
  // pnpm materialises its dependency graph as SYMLINKS (node_modules/.pnpm/... and
  // apps/api/node_modules/pg -> ../../../node_modules/.pnpm/pg@.../...). A pnpm run
  // that repoints one of those links mutates the primary checkout's dependency
  // graph while leaving every regular file byte-identical. A fingerprint built
  // from `find -type f` alone therefore proves nothing: it is blind to exactly
  // the mutation this guard exists to detect.
  //
  // Assert on the ACTUAL find invocations, not on prose: the helper's comments
  // legitimately mention `find -type f` when explaining the failure mode, so a
  // naive text scan would flag the explanation as the defect. Shell comments
  // are stripped before scanning.
  const source = read(BOOTSTRAP);
  const code = source
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  const findCalls = code.match(/find[^\n]*/g) ?? [];
  assert.ok(findCalls.length > 0, `${BOOTSTRAP} must fingerprint with find`);

  const fileOnlyCalls = findCalls.filter(
    (call) => /-type\s+f/.test(call) && !/-type\s+l/.test(call)
  );
  assert.deepEqual(
    fileOnlyCalls,
    [],
    `${BOOTSTRAP} must not fingerprint regular files without also covering symlinks: ${JSON.stringify(fileOnlyCalls)}`
  );

  assert.match(source, /readlink|ls\s+-ld/, `${BOOTSTRAP} must resolve symlink targets, not just their names`);
});

test("US-0004 tooling: the fingerprint covers the api package's own node_modules tree", () => {
  // apps/api/node_modules is a SIBLING tree of the root node_modules, not a
  // subdirectory of it — and it is precisely the tree that holds the `pg` and
  // `@types/pg` links this card is about. Fingerprinting only the root
  // node_modules leaves the very links that cause the TS2307 cascade
  // unguarded: repointing apps/api/node_modules/pg leaves every file under the
  // root node_modules byte-identical, so the root fingerprint would still
  // report "unchanged".
  const source = read(BOOTSTRAP);
  const code = source
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  // Anchor on the PRIMARY-scoped path: the state-inspection helpers also
  // mention "apps/api/node_modules" (as "$1/apps/api/node_modules/..."), so a
  // loose match would be satisfied by the very code that only READS the tree.
  assert.match(
    code,
    /"\$PRIMARY\/apps\/api\/node_modules"/,
    `${BOOTSTRAP} must fingerprint apps/api/node_modules, not only the root node_modules`
  );
});

test("US-0004 tooling: the helper targets the worktree it lives in, not the caller's cwd", () => {
  // Defaulting the target to $PWD is wrong: an agent that runs the helper from a
  // subdirectory (or from the primary checkout while intending to provision a
  // worktree) would silently provision the WRONG directory and then report a
  // green state for a tree that was never provisioned. The default must be the
  // git worktree root that contains the script itself.
  const source = read(BOOTSTRAP);
  assert.match(
    source,
    /show-toplevel|git-common-dir/,
    `${BOOTSTRAP} must resolve its target from git, not from the caller's working directory`
  );
  assert.doesNotMatch(
    source,
    /TARGET="\$PWD"/,
    `${BOOTSTRAP} must not default the target to the caller's working directory`
  );
});

test("US-0004 tooling: the helper reports the compiler it will use", () => {
  // A worktree with no node_modules resolves `tsc` from whatever is on PATH.
  // On a developer machine that can be a globally installed, unpinned compiler
  // (observed: tsc 6.0.3 from an unrelated toolchain) instead of the pinned
  // workspace compiler (typescript 5.7). The reported gate must therefore name
  // the compiler version so a RED result is attributable to the source and not
  // to an accidental compiler swap.
  const source = read(BOOTSTRAP);
  assert.match(source, /--version/, `${BOOTSTRAP} must report the resolved compiler version`);
  assert.match(source, /typescript/i, `${BOOTSTRAP} must reason about the pinned typescript version`);
});
