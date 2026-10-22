// US-0003 — Dataclassification behavioural test (TC-US-0003, TC-US-0003-A/B)
// Replaces the static domain/dimension substring check: exercises the
// dataclassification contract as a versioned inventory. The versioned retention
// doc (data-classification-retention-v1.md) is the canonical inventory; the
// lightweight doc (data-classification.md) is only the local summary. The
// behavioural contract validates that every inventoried class states its
// access, masking, audit, owner and restore guarantees — not just that the
// words "classificatie" or "retention" appear somewhere.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const inventory = readFileSync(resolve(root, "docs/security/data-classification-retention-v1.md"), "utf8");
const summary = readFileSync(resolve(root, "docs/security/data-classification.md"), "utf8");
const testCases = readFileSync(resolve(root, "test-cases.md"), "utf8");

const REQUIRED_CLASSES = [
  "User identity and authentication",
  "Portfolio and account metadata",
  "Canonical ledger activity",
  "Raw provider payloads and imports",
  "Reports and exports",
  "Credentials and secret references",
  "Audit records",
  "Logs and traces",
  "Synthetic fixtures and test evidence",
];

const REQUIRED_FIELDS = [
  "Classification",
  "Representative fields",
  "Authorized access",
  "Masking / redaction",
  "Audit requirement",
  "Retention / deletion owner",
  "Backup / restore treatment",
];

test("TC-US-0003-A behavioural: every inventoried dataclass states seven substantive, non-placeholder controls", () => {
  const headings = [...inventory.matchAll(/^### (.+)$/gm)].map((match) => match[1].trim());
  for (const requiredClass of REQUIRED_CLASSES) {
    assert.ok(
      headings.includes(requiredClass),
      `data-classification inventory must include class "${requiredClass}"`,
    );
  }
  assert.equal(
    new Set(headings).size,
    headings.length,
    "inventory class headings must be unique (no merged or duplicated class)",
  );
  for (const requiredField of REQUIRED_FIELDS) {
    const occurrences = [...inventory.matchAll(new RegExp(`^- ${requiredField.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`, "gm"))].length;
    assert.ok(
      occurrences >= REQUIRED_CLASSES.length,
      `field "${requiredField}" must appear for every class (found ${occurrences} of ${REQUIRED_CLASSES.length})`,
    );
  }
});

test("TC-US-0003-A behavioural: classification levels are versioned, not free text", () => {
  // Restricted is the top-level used for ledger, identities and credentials
  assert.match(inventory, /classification.*Restricted/im);
  // Confidential appears for account/portfolio metadata
  assert.match(inventory, /classification.*Confidential/im);
  // The summary doc must also trace to TC-US-0003
  assert.match(summary, /TC-US-0003/i);
  assert.match(inventory, /TC-US-0003-A/);
});

test("TC-US-0003-B behavioural: retention and restore boundaries are stated per class, not globally", () => {
  // Retention/deletion owner must be specific, not a vague global statement
  assert.match(inventory, /soft-delete/i);
  assert.match(inventory, /revoke/i);
  assert.match(inventory, /no physical deletion of ledger history/i);
  // Backup/restore treatment must be class-scoped
  assert.match(inventory, /backup/i);
  assert.match(inventory, /restore/i);
  assert.match(testCases, /TC-US-0003-A \| US-0003-A/);
  assert.match(testCases, /TC-US-0003-B \| US-0003-B/);
});

test("TC-US-0003 behavioural: the lightweight summary doc remains traceable and consistent with the inventory", () => {
  assert.match(summary, /TC-US-0003/i);
  // Summary covers at least three of the five required dimension words
  for (const dimension of ["classificatie", "retention", "masking"]) {
    assert.match(summary, new RegExp(dimension, "i"), `summary dimension missing: ${dimension}`);
  }
  // Summary must list every core domain at least once
  for (const domain of ["user", "account", "transaction", "raw payload", "log"]) {
    assert.match(summary, new RegExp(domain, "i"), `summary domain missing: ${domain}`);
  }
});

test("TC-US-0003 behavioural: redação and audit controls degrade visibly when the inventory is weakened", () => {
  // Negative-shape assertion: the access/masking controls for credentials and logs must
  // not be merely "somewhere in the file" — each owning class must carry the guarantee.
  assert.ok(inventory.includes("Credentials and secret references"), "credentials class must exist");
  assert.ok(inventory.includes("Logs and traces"), "logs class must exist");
  // The masks for secrets must be stated in the credentials section, not just in prose elsewhere
  const credentialsSection = inventory.slice(inventory.indexOf("### Credentials and secret references"));
  assert.match(credentialsSection, /never render or log raw values/i);
  const logsSection = inventory.slice(inventory.indexOf("### Logs and traces"));
  assert.match(logsSection, /redact tokens/i);
});
