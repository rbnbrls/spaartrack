import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const reportPath = resolve(root, 'docs/backlog/b-004-inventory-provenance-audit-2026-10-19.md');

test('B-004 audit binds current source claims to the finalization snapshot', async () => {
  const report = await readFile(reportPath, 'utf8');
  assert.match(report, /At report finalization[\s\S]*?primary `roadmap\.md` SHA-256 `06d282510d406e4fd320f559abf1814ca9aa7335045505baf0719b246a91cad3`/);
  assert.ok(report.includes('8a501ac97a1cf24eae8576ef5eb1827b17774be0210c4b2587f46f214322f65f'));
  assert.match(report, /8a501ac97a1cf24eae8576ef5eb1827b17774be0210c4b2587f46f214322f65f hash was a prior correction-time primary snapshot/);
  assert.doesNotMatch(report, /Current source hashes: primary `roadmap\.md` SHA-256 `8a501ac97a1cf24eae8576ef5eb1827b17774be0210c4b2587f46f214322f65f`/);
  assert.match(report, /Done lokaal[\s\S]*?local claims, not independently verified completion/);
});

test('B-004 audit enumerates both created artifacts and both exercised contracts', async () => {
  const report = await readFile(reportPath, 'utf8');
  assert.match(report, /The only files created by this task are this audit note and `tests\/smoke\/b004-inventory-audit-provenance\.test\.mjs`\./);
  assert.match(report, /The refinement contract and the provenance contract are the only test artifacts exercised/);
  assert.ok(report.includes('`tests/smoke/backlog-refinement-contract.test.mjs`'));
  assert.ok(report.includes('`tests/smoke/b004-inventory-audit-provenance.test.mjs`'));
});

test('B-004 tracker finding is backed by the expansion-aware command and source provenance', async () => {
  const report = await readFile(reportPath, 'utf8');
  assert.match(report, /audit_tracker_links_t_f4915e56\.mjs/);
  assert.match(report, /TRACE_ID=arch-tf4915e56-tracker-expansion-final CORRELATION_ID=arch-tf4915e56-tracker-expansion-final node \/Users\/ruben\/\.hermes\/profiles\/architecture\/cache\/scratch\/audit_tracker_links_t_f4915e56\.mjs/);
  assert.match(report, /201 unique expanded TC-US refs[\s\S]*?50 missing refs/);
  assert.match(report, /tracker source HEAD `cf5e8c434f216ebe4507f5ba5039fc32e3bd9e36`[\s\S]*?Tracker path SHA-256 `649e756a028a63f211b7a9cacf1bb36c84e31fb4176fe4d78d5bf74c411c5035`/);
  assert.match(report, /heuristic comparison[\s\S]*?not used as the expansion-aware baseline/);
  assert.match(report, /TRACE_ID=arch-tf4915e56-provenance-final-r5 CORRELATION_ID=arch-tf4915e56-provenance-final-r5 node --test tests\/smoke\/b004-inventory-audit-provenance\.test\.mjs/);
  assert.match(report, /3 passed, 0 failed, 0 skipped/);
  assert.match(report, /node --check tests\/smoke\/b004-inventory-audit-provenance\.test\.mjs.*passed/);
  assert.match(report, /git diff --check.*passed/);
  assert.match(report, /Provenance contract SHA-256 `[a-f0-9]{64}`/);
});
