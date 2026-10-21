import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const matrix = readFileSync('docs/backlog/w0-w1-readiness-gate-matrix-2026-10-20.md', 'utf8');
const roadmap = readFileSync('roadmap.md', 'utf8');
const cases = readFileSync('test-cases.md', 'utf8');

function rows(md) {
  return md.split('\n').filter((l) => /^\| (?:US-|TC-US-|TC-X-)/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

test('w0-w1 readiness gate matrix covers required Wave 0/1 gates and reconciles 133/118/251/12 against source', () => {
  for (const id of ['W0-1', 'W0-2', 'W0-3', 'W0-4', 'W0-5', 'W1-A', 'W1-B']) {
    assert.ok(matrix.includes(id), `matrix must contain gate ${id}`);
  }
  const parentRows = rows(roadmap).filter(([id]) => /^US-\d{4}$/.test(id));
  const distinctParents = new Set(parentRows.map(([id]) => id));
  assert.equal(distinctParents.size, 133, 'roadmap distinct parents must be 133');
  const childRows = rows(roadmap).filter((r) => /^US-\d{4}$/.test(r[0]) && /^US-\d{4}-[A-Z]$/.test(r[1]));
  const distinctChildren = new Set(childRows.map((r) => r[1]));
  assert.equal(distinctChildren.size, 118, 'distinct atomic children must be 118');
  const tcRows = rows(cases).filter(([id]) => /^TC-(?:US-|X-)/.test(id));
  const tcX = tcRows.filter(([id]) => id.startsWith('TC-X-'));
  assert.equal(tcX.length, 12, 'TC-X rows must be 12');
  assert.equal(tcRows.length, 280, 'total TC rows must be 280 (268 TC-US + 12 TC-X)');
  const narrow = tcRows.filter(([id]) => /^TC-US-\d{4}(?:-[A-Z])?$/.test(id));
  assert.ok(narrow.length >= 251, `narrow TC-US rows must be at least 251, got ${narrow.length}`);
});

test('matrix distinguishes green docs/local from RED/NOT VERIFIED/external without promoting unverified runtime', () => {
  // row fields are pipe-separated, so match across pipes with [\s\S]
  assert.match(matrix, /W0-2[\s\S]*?RED \/ BLOCKED/, 'W0-2 must be RED/BLOCKED');
  assert.match(matrix, /W0-3[\s\S]*?NOT VERIFIED/, 'W0-3 must be NOT VERIFIED');
  assert.match(matrix, /W1-A[\s\S]*?NOT VERIFIED/, 'W1-A must be NOT VERIFIED in this documentation-only audit');
  assert.match(matrix, /W1-B[\s\S]*?NOT PROVEN/, 'W1-B must be NOT PROVEN / EXTERNAL');
  assert.match(matrix, /No general financial ledger\/calculation implementation/, 'must forbid downstream financial work');
  assert.match(matrix, /not on main/, 'must note mainline vs worktree-owned artifacts');
});

test('matrix references exact owners, artifacts and SHAs and forbids unsafe downstream', () => {
  for (const needle of ['t_0a835fa0', 't_03346202', 't_728c35a1', 't_ab20f0c4', 'poort-b-platform-gate-evidence', 'fab49880']) {
    assert.ok(matrix.includes(needle), `matrix must cite ${needle}`);
  }
  assert.match(matrix, /Downstream forbidden/, 'must have downstream-forbidden section');
  assert.match(matrix, /Source-reproduced snapshot:.*95e0e04/, 'must pin source snapshot');
});
