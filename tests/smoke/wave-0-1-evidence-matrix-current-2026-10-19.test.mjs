import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const matrix = readFileSync(new URL("docs/backlog/wave-0-1-evidence-gate-matrix-2026-10-19T1940+0200.md", root), "utf8");

test("current W0/1 supplement records bounded decisions, inventory gap, and blocked gates", () => {
  assert.match(matrix, /201\/251 TC-US references/);
  assert.match(matrix, /50 omissions are parent epic TC links/);
  assert.match(matrix, /audited source-snapshot tracker gap/);
  assert.match(matrix, /Follow-up `t_651f2352` has completed an isolated corrected candidate/);
  assert.match(matrix, /077081849c2b9ea183cc08cc55c9a886914fded3f2a60d02dc5d60b8e4809009/);
  assert.match(matrix, /Independent QA `t_66446e65` is BLOCKED awaiting provenance\/status corrections[^\n]*candidate is NOT QA-approved/);
  assert.match(matrix, /roadmap\.md` SHA-256 is `708af2255027bf3e298de60b8b77ec9b265d243917852cd6ef66f770d7bd4e23` and `test-cases\.md` SHA-256 is `abf8c7eec1ace6c6452a46869cb7b9fad7aa4407b5b3d3815cc7cb454596e4a6`/);
  assert.match(matrix, /Neither the audited source snapshot nor corrected candidate is integrated into primary\/mainline/);
  assert.match(matrix, /D-SHORT-01: Ledger v2 decides bounded reject-all-shorts/);
  assert.match(matrix, /D-OVERDRAFT-01[^\n]*NOT DECIDED/);
  assert.match(matrix, /General acquisition\/disposal fee-tax allocation beyond those cases is NOT DECIDED/);
  assert.match(matrix, /D-ROUNDING-01: bounded Ledger concurrence/);
  assert.match(matrix, /D-COST-BASIS-01[^\n]*no implicit default/);
  assert.match(matrix, /Canonical residual persistence, canonical serialization\/digest inputs and replay\/restore equality remain NOT DECIDED/);
  assert.match(matrix, /D-TRANSFER-01:.*remain unresolved/);
  assert.match(matrix, /A-case SELL field:.*remains NOT DECIDED/);
  assert.match(matrix, /W0-2[^\n]*RED \/ BLOCKED/);
  assert.match(matrix, /independent QA rejected completion of its narrow evidence gate/);
  assert.match(matrix, /Poort B[^\n]*NOT PROVEN \/ BLOCKED/);
  assert.match(matrix, /Poort C[^\n]*BLOCKED/);
  assert.match(matrix, /Poort A[^\n]*NOT APPROVED \/ BLOCKED \/ NOT GREEN/);
  assert.match(matrix, /`79\/133` and `168\/168` are strictly the dated 17 October 2026 historical snapshot/);
  assert.match(matrix, /NOT AUTHORIZED/);
  assert.match(matrix, /No change to ADR-0001\/ADR-0002, bounded contexts, application-service boundaries, event contracts, financial invariants, fixtures, schema, migrations or product behavior/);
});
