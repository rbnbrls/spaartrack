import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");

const [architecture, adrLedger, adrModules, cases] = await Promise.all([
  read("docs/architecture.md"),
  read("docs/adr/0002-canonical-ledger.md"),
  read("docs/adr/0001-modular-monolith.md"),
  read("test-cases.md"),
]);
const contract = `${architecture}\n${adrLedger}\n${adrModules}`;

test("TC-US-0001-A: ledger command authorization, atomicity, idempotency and event boundary are executable contracts", () => {
  const testCase = cases.match(/^\| TC-US-0001-A \|.*$/m)?.[0] ?? "";
  assert.match(contract, /principal only from the authenticated session/i);
  assert.match(contract, /OWNER or EDITOR/i);
  assert.match(contract, /403.*PORTFOLIO_ROLE_FORBIDDEN|PORTFOLIO_ROLE_FORBIDDEN.*403/);
  assert.match(contract, /namespace is `\(financial_account_id, identity_kind, identity_value\)`/);
  assert.match(contract, /reusing the same identity from a different connection\/source returns the original transaction and entries.*otherwise it returns `409 IDEMPOTENCY_KEY_CONFLICT`/);
  assert.match(contract, /Reusing the same identity in another account is valid and independent/);
  assert.match(contract, /ledger_transaction.*ledger_entry.*actor\/source\/trace\/correlation audit record.*commit atomically/);
  assert.match(contract, /event publication is post-commit only|Publicatie gebeurt alleen na commit/i);
  assert.match(contract, /replay-hash algorithm is not specified.*replay determinism is NOT VERIFIED/i);
  assert.match(testCase, /401 unauthenticated, 403 unauthorized/);
  assert.match(testCase, /commit atomically/);
  assert.match(testCase, /exact replay creates no new records/);
  assert.match(testCase, /409 without writes/);
  assert.match(testCase, /correction\/VOID preserves history/);
  assert.match(testCase, /direct SQL writes are forbidden/);
});

test("TC-US-0001-B: provider adapter review, identity and failure semantics are explicit", () => {
  const testCase = cases.match(/^\| TC-US-0001-B \|.*$/m)?.[0] ?? "";
  assert.match(contract, /Provider adapter contract: `fetch\(/i);
  assert.match(contract, /raw provider evidence.*typed candidates/i);
  assert.match(contract, /PENDING_REVIEW.*explicitly `APPROVE`.*`REJECT`/);
  assert.match(contract, /connection.*financial-account ID/i);
  assert.match(contract, /Provider connection\/source is retained as provenance/i);
  assert.match(contract, /reusing a key in another connection or source for the same account conflicts if normalized command content differs, or is an exact replay if normalized command content is identical/i);
  assert.match(contract, /409 IDEMPOTENCY_KEY_CONFLICT/);
  assert.match(contract, /Timeout\/429 failures are retryable.*401\/403.*stop automatic retry/s);
  assert.match(testCase, /timeout\/429, 401\/403 or schema drift/);
  assert.match(testCase, /same external identity is presented through another connection/);
  assert.match(testCase, /same account across connections is exact replay only for identical normalized Ledger command and otherwise conflicts/);
  assert.match(testCase, /another account is independent/);
  assert.match(testCase, /adapter only creates raw evidence\/candidates/);
  assert.match(testCase, /candidate states and bounded retry\/stop behavior are visible/);
  assert.match(testCase, /only approval invokes Ledger/);
  assert.match(testCase, /no failure\/retry path posts Ledger data/);
});

test("TC-US-0001-C: context query ownership and read-only projections are explicit", () => {
  const testCase = cases.match(/^\| TC-US-0001-C \|.*$/m)?.[0] ?? "";
  for (const context of ["Portfolio", "Income & Performance", "Money Flow", "Tax & Reporting", "AI & Addons"]) {
    assert.ok(contract.includes(context), `missing bounded context ${context}`);
  }
  assert.match(contract, /Portfolio query services read Portfolio-owned registry\/configuration/);
  assert.match(contract, /Income & Performance reads committed ledger facts/);
  assert.match(contract, /Money Flow reads classified, scope-bound ledger projections/);
  assert.match(contract, /Tax & Reporting reads authorized source facts/);
  assert.match(contract, /UI and AI call only these authorized query services/);
  assert.match(contract, /forbidden from writing back to Ledger/i);
  assert.match(testCase, /Portfolio owns its registry but not financial truth/);
  assert.match(testCase, /pinned calculation versions/);
  assert.match(testCase, /no query\/projection can mutate the Ledger/);
});
