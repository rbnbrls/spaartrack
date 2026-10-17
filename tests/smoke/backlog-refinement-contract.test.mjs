import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const refinementPath = resolve(root, 'docs/backlog/b-004-refinement.md');
const expectedParents = [
  ...Array.from({ length: 5 }, (_, i) => `US-${String(i + 1).padStart(4, '0')}`),
  ...Array.from({ length: 3 }, (_, i) => `US-${String(1105 + i).padStart(4, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `US-${String(1201 + i).padStart(4, '0')}`),
  ...Array.from({ length: 7 }, (_, i) => `US-${String(1301 + i).padStart(4, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `US-${String(1401 + i).padStart(4, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `US-${String(1501 + i).padStart(4, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `US-${String(1601 + i).padStart(4, '0')}`),
  ...Array.from({ length: 9 }, (_, i) => `US-${String(1701 + i).padStart(4, '0')}`),
];

function rows(markdown) {
  return markdown.split('\n')
    .filter((line) => /^\| (?:US-|TC-US-)/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

test('B-004 refinement covers all remaining parent stories and executable traceability', async () => {
  const [roadmap, tests, refinement] = await Promise.all([
    readFile(resolve(root, 'roadmap.md'), 'utf8'),
    readFile(resolve(root, 'test-cases.md'), 'utf8'),
    readFile(refinementPath, 'utf8'),
  ]);
  const parentRows = rows(roadmap).filter(([id]) => /^US-\d{4}$/.test(id));
  const availableParents = new Set(parentRows.map(([id]) => id));
  assert.deepEqual(expectedParents.filter((id) => !availableParents.has(id)), [], 'roadmap parent IDs must exist');

  const childRows = rows(roadmap).filter((row) => /^US-\d{4}$/.test(row[0]) && /^US-\d{4}-[A-Z]$/.test(row[1]) && expectedParents.includes(row[0]));
  const childIds = new Set(childRows.map((row) => row[1]));
  const caseIds = new Set(rows(tests).map((row) => row[0]));
  const entries = rows(refinement).filter((row) => /^US-\d{4}(?:-[A-Z])?$/.test(row[0]));
  const remainingParents = parentRows.filter(([id]) => expectedParents.includes(id));
  const parentsWithChildren = new Set(childRows.map((row) => row[0]));
  const expectedWorkIds = [
    ...remainingParents.map(([id]) => id).filter((id) => !parentsWithChildren.has(id)),
    ...childIds,
  ].sort();
  const actualWorkIds = entries.map(([id]) => id).sort();

  assert.equal(entries.length, expectedWorkIds.length, 'each remaining atomic child or standalone parent needs one work entry');
  assert.deepEqual(actualWorkIds, expectedWorkIds, 'work IDs must match all remaining atomic roadmap stories exactly');
  assert.equal(new Set(actualWorkIds).size, actualWorkIds.length, 'work IDs must be unique');
  assert.deepEqual([...new Set(entries.map((row) => row[1]))].sort(), [...expectedParents].sort(), 'all 54 remaining parents must be represented');
  for (const [workId, parentId, owner, dependency, testId, fixture, nonGoals, exit] of entries) {
    assert.ok(expectedParents.includes(parentId), `${workId} must belong to the remaining parent set`);
    assert.ok(owner && dependency && testId && fixture && nonGoals && exit, `${workId} must specify owner, dependency, test, fixture, non-goals, and exit`);
    if (workId !== parentId) assert.ok(childIds.has(workId), `${workId} must be a roadmap child story`);
    assert.ok(caseIds.has(testId), `${workId} must link to an existing test case: ${testId}`);
  }
});
