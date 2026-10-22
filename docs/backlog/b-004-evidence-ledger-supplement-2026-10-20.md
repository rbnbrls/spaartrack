# B-004 — evidence ledger supplement 2026-10-20

Status: documentation-only supplement to `b-004-story-ledger.md` and
`b-004-refinement.md`. First prepared in isolated worktree `t_6eb0ecda`
(branch `spaartrack/t_6eb0ecda-refresh-133-story-evidence-ledger-after`,
HEAD `a201d5d`) after Wave 1 gate handoffs settled, and **corrected** in
worktree `t_f3781eaa` (branch
`spaartrack/t_f3781eaa-correct-the-b-004-evidence-ledger-supple`) after the
independent QA review `t_bb3d0d10` returned **FAIL — CHANGES REQUIRED** with
9 findings (F1–F8). The pinned snapshot `a201d5d` is unchanged; this edition
corrects the *figures, attributions and reproducible command* of the first
edition. This file does not re-mark roadmap stories Done, does not modify
`roadmap.md`, `test-cases.md`, `backlog.md`, code, schema, or migrations, and
does not claim merge/release.

Date: 2026-10-20
Worktree: `/Users/ruben/spaartrack/.worktrees/t_6eb0ecda` (first edition),
`/Users/ruben/spaartrack/.worktrees/t_f3781eaa` (corrected edition)
Author task: `t_6eb0ecda` (architecture); corrected edition `t_f3781eaa`
(architecture). Replacement for blocked refresh `t_09486922`; superseded
remediation `t_dc710c02` not depended upon.

## 1  Sources and content hashes (bytes in this checkout and cited artifacts)

No secrets, tokens, credentials, or connection strings are recorded.

| Artifact | Location / binding | SHA-256 |
|---|---|---|
| `roadmap.md` (current checkout, committed at `a201d5d`) | `roadmap.md` in this worktree | `83dd154c5c459f6b63c4e547a104f6428f32684f0ad804ac97f698db67a50879` |
| `test-cases.md` (current checkout, committed at `a201d5d`) | `test-cases.md` in this worktree | `7ba46f28845742a411d94cfc26c8e8b2f3e30bfe2e10847a690cd16b359c2bcf` |
| `backlog.md` (current checkout) | `backlog.md` in this worktree | `acece8aac2f965904a1942e7e3a9f9c677596f0da3fea95623839645700bdbf9` |
| `docs/backlog/b-004-refinement.md` | `docs/backlog/b-004-refinement.md` | `c754b9a82cd7be16119296a7dbe100b778e72fa805f152d9f04d47aa34a5e032` |
| `docs/decisions/w0-2-policy-reconciliation.md` (W0-2 reconciliation) | `docs/decisions/w0-2-policy-reconciliation.md` in this worktree | `37763f8059aac9e6d9227dc23f0c640649d491c81ac346a3e4b0af02916144ac` |
| `infra/policies/release-policy.yaml` | `infra/policies/release-policy.yaml` | `c77d28261674ae1e54f46d41f83b28ca5ea30d3ff5e870215c5787be026a2caf` |
| B-004 ledger (initial inventory, worktree `t_73233975`, HEAD `cf5e8c4`) | `/Users/ruben/spaartrack/.worktrees/t_73233975/docs/backlog/b-004-story-ledger.md` (isolated artifact, not on mainline at `a201d5d`) | `649e756a028a63f211b7a9cacf1bb36c84e31fb4176fe4d78d5bf74c411c5035` |
| B-004 ledger corrected provenance (worktree `t_8267b4f8`, HEAD `47384ff`, pinned source `708af225…` / `64b78d5…`) | `/Users/ruben/spaartrack/.worktrees/t_8267b4f8/docs/backlog/b-004-story-ledger.md` (isolated candidate, not on mainline) | `4c0cf866c7ba28ecec3fa6dae903411d2ff4f31b98decf30def64eca48a6ba06` |
| Pre-correction candidate basis (worktree `t_651f2352`, base `0e09d98`) | `/Users/ruben/spaartrack/.worktrees/t_651f2352/docs/backlog/b-004-story-ledger.md` | `077081849c2b9ea183cc08cc55c9a886914fded3f2a60d02dc5d60b8e4809009` |
| Poort B read-only diagnostic `t_0915a5c8` | `/Users/ruben/spaartrack/.worktrees/t_0915a5c8/poort-b-api-bootstrap-diagnostic-2026-10-18.md` | `cf7d971e3f5fe6645ad22b1da18754d85b071a40e1a52d72dfd2a5d2c7909954` |
| Poort A fresh read-only report `t_adb50ce5` (HEAD `cf5e8c4`; gate `BLOCKED_NOT_PROVEN` before integration) | `/Users/ruben/spaartrack/.worktrees/t_adb50ce5/qa-evidence-b005-poort-a-20261018.md` | `9ff4260e11e414fa8d67324e3e1f900c8be9f361b3af466f698b2016939ef867` (5297 bytes) |
| Poort A remediation evidence `t_1b20f3bd` | `/Users/ruben/spaartrack/.worktrees/t_1b20f3bd/qa-evidence-poort-a-remediation.md` | `2dda93f92d52efc5cac30bed8e805300ecbcd7854550b4777767f61664117d11` (5691 bytes) |
| Independent 133-story traceability audit | `/Users/ruben/spaartrack/.worktrees/t_aad17517/docs/backlog/independent-133-story-traceability-audit.md` | `6177ff335f36d89544fdd6f6d28bb591993283fb5cac34de7ec41d4937a35600` (104 lines) |
| Privacy isolated evidence (worktree `t_bd84d889-privacy`, HEAD `d0ce3db`) — not present on mainline worktree `t_6eb0ecda` | `apps/api/src/privacy.ts` | `1214f5c2096a0aa825ce9d3d4438229d6553300c3081e2d7c769974615bc4e91` |
| | `apps/api/src/privacy-export.ts` | `71f6d18c7fb1c901e6ee34830899f00a9015fc074e0a5c911e9f13c37559ae40` |
| | `apps/api/src/privacy-deletion.ts` | `f9afd9f7120812381cfc771c7c0e4525e6a9e52457c3affc8a8cf8289213c253` |
| | `database/migrations/0029-privacy-deletion-tombstone.sql` | `58efada02f35b4fa45724ff98aa3b38c115f52809a2790de3be04da7eab6358c` |

All B-004 ledgers, Poort A/B diagnostics, the independent audit, and the privacy
artifact remain isolated worktree files; none is present on `main`/`a201d5d`
as a mainline delivery. This corrected edition of the supplement is tracked on
branch `spaartrack/t_f3781eaa-correct-the-b-004-evidence-ledger-supple` only
and is not merged to `main`; task completion here is not a merge or release.

## 2  Inventory reconciliation (independently reproducible)

Counts are derived from exact headings and ID patterns in the pinned snapshot
`a201d5d`, not from mutable line numbers. `roadmap.md` and `test-cases.md` are
byte-identical between `a201d5d` and the corrected-edition HEAD `c8e6d9a`
(`git diff --stat a201d5d c8e6d9a -- roadmap.md test-cases.md` is empty), so the
figures below hold for both.

- Inventory heading: `roadmap.md:755` `### User-story backlog per delivery slice`
- Refinement heading: `roadmap.md:990` `### Refinement pass: epics versus atomic stories`
- Test catalog heading: `test-cases.md:51` `## Testgevallen per delivery slice`
- Cross-cutting tests begin at `test-cases.md` cross-cutting section; `TC-X-*` rows are additional.

| Inventory | Count | Method |
|---|---:|---|
| Parent `US-*` stories declared in roadmap backlog table | 133 | `^| US-#### |` rows between the two headings; unique 133 |
| Atomic child stories declared in refinement table | 118 | `^| US-#### | US-####-X |` rows; unique 118 |
| Expected story-to-test links (`TC-` + each parent/child ID) | 251 | 133 + 118 |
| `TC-US-*` rows in `test-cases.md` (all shapes) | 268 | `^| TC-US-` rows, any suffix shape and any suffix case (`TC-US-\d{4}(?:-[A-Za-z0-9]+)*`) |
| Of those: strict structural shape `TC-US-####` / `TC-US-####-X` | 252 | 251 expected links + 1 deliberate alias (`TC-US-0203-C`, see §2.3) |
| Extra multi-segment IDs beyond the strict structural shape | 16 | `TC-US-0201-AUTH`, `TC-US-0203-OIDC-DEPLOY`, `TC-US-0503-UX`, `TC-US-0705-UX`, `TC-US-0802-live`, `TC-US-0802-live-auth`, `TC-US-0802-settings`, `TC-US-0803-live`, `TC-US-0803-live-runtime`, `TC-US-1105-UX`, `TC-US-1201-UX`, `TC-US-1401-UX`, `TC-US-1402-UX`, `TC-US-1403-UX`, `TC-US-1404-UX`, `TC-US-1601-UX` — see §2.1 |
| Structural coverage of expected links | 251/251 | every expected `TC-US-####` and `TC-US-####-X` present once |
| Duplicates | 0 | no duplicate test ID |
| Story-column mismatches (ID vs Story column) | 0 | every expected ID matches its Story column |
| Cross-cutting `TC-X-*` rows | 12 | additional to story-linked rows |
| All catalog rows (`TC-US-*` + `TC-X-*`) | 280 | 268 + 12 |

### 2.1  Why 268, not 251, story-linked rows were observed in this checkout

The independently archived audit
`independent-133-story-traceability-audit.md` (worktree `t_aad17517`, bound to
an earlier snapshot at `cf5e8c4`) correctly reported 251 story-linked `TC-US-*`
rows and 12 `TC-X-*` rows, with `missing=0`, `unexpected=0`. That audit used a
filter `TC-US-\d{4}(?:-[A-Z])?` and ran before later catalog extensions.

Between `cf5e8c4` and the pinned snapshot `a201d5d`, three catalog extensions
landed, adding 17 story-linked rows in total (251 → 268, verified by
`git show <rev>:test-cases.md | grep -c '^| TC-US-'`: `cf5e8c4` 251,
`c01d481` 260, `24fa997` 265, `ca1c9a5` 268):

- `c01d481` added the nine UX multi-segment cases `TC-US-*-UX`
  (`TC-US-0503-UX`, `TC-US-0705-UX`, `TC-US-1105-UX`, `TC-US-1201-UX`,
  `TC-US-1401-UX`, `TC-US-1402-UX`, `TC-US-1403-UX`, `TC-US-1404-UX`,
  `TC-US-1601-UX`) with the story column pointing to the parent (e.g.
  `US-0503`). These are runtime UX extensions, not new roadmap parents/children.
  Attribution verified with `git log --oneline -S "TC-US-0503-UX" -- test-cases.md`
  → `c01d481` (the same for each of the nine ids).
- `24fa997` added the five lowercase-suffix multi-segment rows
  `TC-US-0802-live`, `TC-US-0802-settings`, `TC-US-0802-live-auth`,
  `TC-US-0803-live` and `TC-US-0803-live-runtime` (story columns `US-0802` and
  `US-0803`). Verified with `git log --oneline -S "TC-US-0802-live" -- test-cases.md`
  → `24fa997`. These point at declared parents that own their own acceptance
  row, so they are runtime extensions of an existing parent, not new stories.
- `ca1c9a5` added `TC-US-0201-AUTH` (story `US-0201`) and
  `TC-US-0203-OIDC-DEPLOY` (story `US-0203-B`), and introduced
  `TC-US-0203-C` with story column `US-0203-A` (runtime TOTP replay case
  whose ID suffix `C` does not declare a new `US-0203-C` child in the
  refinement table). The same commit *modified* the pre-existing rows
  `TC-US-0202` and `TC-US-0203-B`; it did not add them
  (`git log --oneline -S "TC-US-0202" -- test-cases.md` → `cf5e8c4`).

All 251 expected structural links remain present once. The 16 extra
multi-segment IDs above are not missing expected links, not duplicates, and
not story-column mismatches against the 251 expected set; they are additional
runtime/UX cases. The story-column of `TC-US-0203-C` points to `US-0203-A` by
design (see §3 row for `US-0203`).

**Baseline reconciliation with the archived audit (F4).** The audit's "263 all
catalog rows" and this document's "280 all catalog rows" are measured against
different baselines and are not comparable without this note:

- The archived audit counted at `cf5e8c4`, where the catalog held 251
  story-linked rows and 12 `TC-X-*` rows → 263 all catalog rows. It had no
  multi-segment rows to lose, because at that snapshot every story-linked id
  was strict-shaped.
- This document counts at `a201d5d`: 268 story-linked rows + 12 `TC-X-*` rows →
  280 all catalog rows. The 17 added story-linked rows are exactly the three
  catalog extensions listed above (9 + 5 + 3).
- Re-running the *archived* snippet unchanged at `a201d5d` does **not**
  reproduce the audit: it returns `parents 130`, `expected_story_links 248` and
  `unexpected ["TC-US-0203-C", "TC-US-1504", "TC-US-1505", "TC-US-1506"]`. The
  archived parent filter is the strict `US-\d{4}` full match, and commit
  `60acd99` added a ` — Title` suffix to the parent rows US-1504, US-1505 and
  US-1506, so those three parents are dropped from the parent list and their
  three test ids appear "unexpected". This is exactly why §2.3 uses the
  suffix-tolerant parent pattern `r'(US-\d{4})(?:\s+—\s+.+)?'`. The same
  archived snippet run at `cf5e8c4` does reproduce the audit
  (133/133, 118/118, 251/251, 12 TC-X, all four empty lists).

### 2.2  Historical 79/133 and 168/168 figures

`backlog.md:8` explicitly directs: never interpret `79/133` or `168/168` as
project completion; those numbers describe the historical local baseline and
its then-current regression run. In this checkout:

- `backlog.md:24` "Local MacBook release: roadmap records 79/133 parent stories
  realized." — historical baseline through `US-1104` (see
  `b-004-refinement.md:8`), not current verification.
- `backlog.md:25` "Local regression: roadmap records 168/168 smoke tests green
  at the latest status entry." — historical regression gate, not the current
  `501/501` full-stack revalidation, and not the offline suite figures quoted
  in §3 (which are skip-heavy and are labelled NOT VERIFIED there).
- `roadmap.md` contains successive superseding snapshots: `88/133` (line 254),
  `123/133` (line 258), `133/133 Done` revalidations at `19 oktober` (lines
  268, 272). Only the latest revalidation's `501/501` evidence (detailed below)
  is a fresh full-stack run; earlier counters are explicitly superseded history.

This supplement preserves those historical labels unchanged and does not
re-label historical evidence as current verification.

### 2.3  Independently reproducible inventory check

Run from repository root (Python standard library only). This is the command
archived in `independent-133-story-traceability-audit.md:47-92`, adapted to the
`a201d5d` snapshot in three ways, each of which is load-bearing:

1. the parent-row pattern is suffix-tolerant — `r'(US-\d{4})(?:\s+—\s+.+)?'` —
   because `60acd99` added ` — Title` to US-1504/1505/1506; the archived
   pattern silently drops those three parents;
2. the story-linked census accepts **any** suffix shape and **any** suffix
   case — `TC-US-\d{4}(?:-[A-Za-z0-9]+)*` — because the archived pattern
   accepted uppercase suffix segments only and silently dropped the five
   lowercase `TC-US-0802/0803-*` rows;
3. the `cases` 3-tuples are unpacked into named variables (`n, tid, story`)
   before the strict structural subset is taken.

```sh
python3 - <<'PY'
from pathlib import Path
from collections import Counter
import re, json, hashlib

def rows(text):
    return [(n, [x.strip() for x in line[1:-1].split('|')])
            for n, line in enumerate(text.splitlines(), 1)
            if line.startswith('|') and line.endswith('|')]

road = Path('roadmap.md').read_text()
catalog = Path('test-cases.md').read_text()
start = road.index('### User-story backlog per delivery slice')
end = road.index('### User-story Definition of Ready', start)
# Parent rows may carry " — Title" suffix (e.g. "| US-1504 — PWA responsive |")
parents = [m.group(1) for m in
           (re.fullmatch(r'(US-\d{4})(?:\s+—\s+.+)?', c[0])
            for _, c in rows(road[start:end]) if len(c) >= 3)
           if m]
start = road.index('### Refinement pass: epics versus atomic stories')
end = road.index('### P0 —', start)
children = [(c[1], c[0]) for _, c in rows(road[start:end])
            if len(c) >= 4 and re.fullmatch(r'US-\d{4}', c[0])
            and re.fullmatch(r'US-\d{4}-[A-Z]', c[1])]
# All TC-US rows (structural + multi-segment), any suffix shape, any case
cases = [(n, c[0], c[1] if len(c) > 1 else '')
         for n, c in rows(catalog)
         if c and re.fullmatch(r'TC-US-\d{4}(?:-[A-Za-z0-9]+)*', c[0])]
# Strict structural shape for expected-link accounting
structural = [(n, tid, story) for n, tid, story in cases
              if re.fullmatch(r'TC-US-\d{4}(?:-[A-Z])?', tid)]
expected = {f'TC-{story}': story for story in parents}
expected.update({f'TC-{child}': child for child, _ in children})
counts = Counter(tid for _, tid, _ in structural)
actual = set(counts)
tc_x = sum(bool(c and re.fullmatch(r'TC-X-\d{3}', c[0])) for _, c in rows(catalog))
extra = sorted(set(tid for _, tid, _ in cases) - actual)
# Parents that own at least one declared atomic child (derived, never subtracted)
parents_with_child = {child[:-2] for child, _ in children}
print(json.dumps({
    'roadmapSha256': hashlib.sha256(road.encode()).hexdigest(),
    'testCasesSha256': hashlib.sha256(catalog.encode()).hexdigest(),
    'parents': len(parents), 'unique_parents': len(set(parents)),
    'children': len(children), 'unique_children': len({x for x, _ in children}),
    'expected_story_links': len(expected),
    'catalog_TC_US_all': len(cases), 'catalog_TC_US_structural': len(structural),
    'unique_structural_ids': len(actual),
    'extra_multi_segment_ids': extra,
    'tc_x_rows': tc_x,
    'all_catalog_rows': len(cases) + tc_x,
    'parents_with_declared_child': len(parents_with_child),
    'parents_without_declared_child': len(set(parents) - parents_with_child),
    'missing': sorted(set(expected) - actual),
    'unexpected_structural': sorted(actual - set(expected)),
    'duplicates': sorted(x for x, n in counts.items() if n > 1),
    'story_column_mismatches': [
        {'line': line, 'test': tid, 'expected': expected[tid], 'actual': story}
        for line, tid, story in structural if tid in expected and story != expected[tid]
    ],
}, indent=2, ensure_ascii=False))
PY
```

Verbatim output of the command above, run from the repository root at the
pinned snapshot (`roadmap.md` / `test-cases.md` byte-identical in `t_6eb0ecda`
at `a201d5d` and in `t_f3781eaa` at `c8e6d9a`), exit status 0:

```json
{
  "roadmapSha256": "83dd154c5c459f6b63c4e547a104f6428f32684f0ad804ac97f698db67a50879",
  "testCasesSha256": "7ba46f28845742a411d94cfc26c8e8b2f3e30bfe2e10847a690cd16b359c2bcf",
  "parents": 133,
  "unique_parents": 133,
  "children": 118,
  "unique_children": 118,
  "expected_story_links": 251,
  "catalog_TC_US_all": 268,
  "catalog_TC_US_structural": 252,
  "unique_structural_ids": 252,
  "extra_multi_segment_ids": [
    "TC-US-0201-AUTH",
    "TC-US-0203-OIDC-DEPLOY",
    "TC-US-0503-UX",
    "TC-US-0705-UX",
    "TC-US-0802-live",
    "TC-US-0802-live-auth",
    "TC-US-0802-settings",
    "TC-US-0803-live",
    "TC-US-0803-live-runtime",
    "TC-US-1105-UX",
    "TC-US-1201-UX",
    "TC-US-1401-UX",
    "TC-US-1402-UX",
    "TC-US-1403-UX",
    "TC-US-1404-UX",
    "TC-US-1601-UX"
  ],
  "tc_x_rows": 12,
  "all_catalog_rows": 280,
  "parents_with_declared_child": 50,
  "parents_without_declared_child": 83,
  "missing": [],
  "unexpected_structural": [
    "TC-US-0203-C"
  ],
  "duplicates": [],
  "story_column_mismatches": []
}
```

The 252nd structural entry is `TC-US-0203-C` (story column `US-0203-A`); it is
structural in shape but its story-column mapping is intentionally to the
existing child `US-0203-A` (see §3). It does not declare a new child ID, which
is why it is the single entry in `unexpected_structural` and not in `missing`.

The parent/child spine is unchanged by the correction: 133 parents, 118
children, 251 expected links, 252 strict structural rows, 12 `TC-X-*` rows,
`missing []`, `duplicates []`, `story_column_mismatches []`. Only the
story-linked row census (263 → 268), the all-catalog total (275 → 280), the
extra-id count (11 → 16) and the two non-subtracted parent counts change.

## 3  Affected US → TC mapping, VERIFIED / NOT VERIFIED / BLOCKED

State shorthand: `R`/`SR` = roadmap snapshot reports local implementation but
NOT independently verified in this worktree; `N` = no roadmap-reported local
evidence in older snapshot; `V-ISOLATED` = verified in a coherent isolated
Compose stack in the cited worktree handoff; `NOT VERIFIED (this worktree)` =
no fresh stacked run in `t_6eb0ecda`; `BLOCKED` = release/policy or remote
dependency prevents verification. `TC exists` means acceptance contract row
exists, not that it passed.

Rows below cover the affected scope from the Wave 1 gate handoffs
(B-004 inventory, W0-2 reconciliation, Poort A/B, privacy). Full 133-row
ledger is in the B-004 ledger artifacts (§1); this supplement maps only the
affected subset with current gate evidence.

| Parent / Work ID | TC ID(s) | Status in this worktree `t_6eb0ecda` | Evidence path / SHA / run | Owner (bounded context) | Dependency | Next gate |
|---|---|---|---|---|---|---|
| US-0001 (epic) and children US-0001-A/B/C | TC-US-0001; TC-US-0001-A/B/C | NOT VERIFIED / BLOCKED — W0 contracts require review; W0-2 QA intentionally RED/BLOCKED | `docs/decisions/w0-2-policy-reconciliation.md` SHA `37763f80…` (`t_ca53a2ba`); B-004 ledgers §1; `roadmap.md:990` refinement; `test-cases.md:51` catalog | architecture | ADR-0001/0002, `docs/architecture.md` | W0-2 review gate; module/event/application-service specification with ledger-owner decision. No implementation authorized. |
| US-0002 (epic) and children US-0002-A/B/C | TC-US-0002; TC-US-0002-A/B/C | NOT VERIFIED / BLOCKED — financial invariants RED/BLOCKED pending Ledger+QA+Calculations decisions | Same W0-2 artifact SHA `37763f80…`; D-FEE-TAX-01 narrowly approved, D-COST-BASIS-01/D-ROUNDING-01/D-SHORT-01/D-OVERDRAFT-01/D-TRANSFER-01 open; SELL cash-leg CREDIT vs `cash_entry_direction_sell=DEBIT` conflict explicitly NOT DECIDED — requires Ledger+QA clarification (and Ledger+Calculations if cash) | architecture + qa + ledger + calculations | LEDGER-001, CALC-001 v1 | Financial invariant test execution blocked until W0-2 decisions land. No schema/migration. |
| US-0003 (epic) US-0003-A/B | TC-US-0003; TC-US-0003-A/B | NOT VERIFIED / BLOCKED — privacy/security classification gate open | W0-2 artifact SHA `37763f80…` | security | SEC-001, US-0206 privacy contract | Data classification, retention, masking, deletion/restore specification; synthetic SEC-001 required. |
| US-0004 | TC-US-0004 | NOT VERIFIED — `AGENTS.md` conventions require team-protocol audit | B-004 ledger `t_73233975` row; `t_8267b4f8` corrected provenance ledger | architecture | Team review of `AGENTS.md` | Repository policy audit; no code change. |
| US-0005 | TC-US-0005 | NOT VERIFIED / BLOCKED — threat-model review open | W0-2 artifact SHA `37763f80…` | security | ADR-0001 boundaries, US-0003 labels | Threat-model review; no production approval implied. |
| US-0101 and children US-0101-A/B/C/D | TC-US-0101; TC-US-0101-A/B/C/D | SR — pinned roadmap reports Done locally (E2E slice early evidence); NOT VERIFIED in `t_6eb0ecda` | `roadmap.md` status narrative (superseded `88/133`, `123/133`, `133/133` revalidations at lines 254, 258, 268); B-004 ledgers; no fresh `STACK_SMOKE` run in `t_6eb0ecda` | platform | W0 | QA re-run on ENV-001 coherent Compose; verify health/logs. |
| US-0102, US-0103, US-0104, US-0105, US-0106, US-0107 (B-001 / Poort B scope) | TC-US-0102; TC-US-0103; TC-US-0104; TC-US-0105; TC-US-0106; TC-US-0107 (and `US-0106-B` etc where declared) | BLOCKED / NOT PROVEN — Poort B remote deployment NOT VERIFIED | Poort B diagnostic `t_0915a5c8` SHA `cf7d971e…` : remote CI run `39066748865` at `cf5e8c4` fails at Start API bootstrap (21 readiness requests, no response bodies); missing `REDIS_URL` reproduces `503 redis_url_missing` locally — plausible cause but remote root cause NOT VERIFIED; immutable artifact/digest/SBOM/migration/smoke/restore/observability/rollback gates remain open | platform (+ orchestrator, qa) | Coolify, registry, `requiredChecks` in `infra/policies/release-policy.yaml` SHA `c77d2826…` | Restore `REDIS_URL` (and paired A/B) in CI, re-run remote bootstrap, and collect immutable-artifact, digest/SBOM, migration-dry-run, restore-replay, and health-window evidence. Do not invent deployment. |
| US-0201 | TC-US-0201 (acceptance); TC-US-0201-AUTH (runtime boundary) | V-ISOLATED in `t_1b20f3bd`/`t_4bdf8636`; NOT VERIFIED in `t_6eb0ecda` | `t_1b20f3bd` evidence SHA `2dda93f9…`: `STACK_SMOKE=1` focused 21/21 pass (incl. `TC-US-0201-AUTH`), full 180/180 pass, 5-m logscan 0 credential leaks, `trace qa-1b20f3bd-*`; `t_4bdf8636` review `a201d5d`: RED→GREEN `dist/apps/api/src/index.js`, 22 pass focused, offline `tsc` 0, offline suite **582 tests / 441 pass / 0 fail / 141 skipped** — `582` is the total test count, not the pass count, and 141 runtime legs are skipped without `STACK_SMOKE=1`, so this is an offline-gate figure only, NOT VERIFIED as a runtime gate; the `STACK_SMOKE=1` runtime baseline at `a201d5d` was red (**582 tests / 534 pass / 47 fail / 1 skipped**, commit `2ae323e` on branch `qa/t_auth-runtime-gate`, which then reported 588 / 587 / 0 / 1 after its fix) — NOT VERIFIED in this worktree; public email-only session denial preserved; `t_adb50ce5` baseline 99/169 (static) confirmed BLOCKED before integration | security + platform | SEC-001, fixture-session route | Security review child `t_31bd8537` queued via `t_1b20f3bd` completion; next: repeat coherent stacked Poort A on clean main checkout and close Poort C. |
| US-0202 | TC-US-0202 | V-ISOLATED (static acceptance) — contract row present | `test-cases.md`: `ca1c9a5` **modified** the pre-existing `TC-US-0202` row (it already existed at `cf5e8c4`; `git log --oneline -S "TC-US-0202" -- test-cases.md` → `cf5e8c4`) to state the public-email login denial and the fixture-authenticator semantics; covered by 180/180 full suite in `t_1b20f3bd` | security | SEC-001 | Same Poort A coherent re-run. |
| US-0203 (epic) US-0203-A (TOTP) US-0203-B (OIDC) | TC-US-0203; TC-US-0203-A; TC-US-0203-B; plus extra TC-US-0203-C (story `US-0203-A`, TOTP replay) and TC-US-0203-OIDC-DEPLOY (story `US-0203-B`, executable `PRODUCTION_OIDC_ADAPTER_UNAVAILABLE`) | V-ISOLATED in `t_1b20f3bd`/`t_4bdf8636`; NOT VERIFIED in `t_6eb0ecda` | Same evidence as `US-0201` plus: `TC-US-0203-OIDC-DEPLOY` RED→GREEN via `dist/apps/api/src/index.js` at `:89` (fix `a201d5d`); `TC-US-0203-C` reuses `US-0203-A` child (no new `US-0203-C` child declares) | security | Local-only TOTP, synthetic OIDC | Verify `OIDC_PROVIDER_VALIDATED=true` startup guard on coherent stack; same next gate as `US-0201`. |
| US-0204 | TC-US-0204 | V-ISOLATED | Covered by 180/180 and 22-pass focused in handoffs | security | Portfolio role boundary | — |
| US-0205 | TC-US-0205 | V-ISOLATED | Covered by 180/180 | security | Audit boundary | — |
| US-0206 (epic) US-0206-A (export) US-0206-B (delete) | TC-US-0206; TC-US-0206-A/B | V-ISOLATED in privacy worktree `t_bd84d889-privacy` (HEAD `d0ce3db`); NOT VERIFIED on mainline worktree `t_6eb0ecda` | Privacy worktree `t_bd84d889-privacy` SHAs §1: `pnpm typecheck` 0, `tests/unit/privacy.test.mjs` 6/6, `tests/smoke/privacy-lifecycle-contract.test.mjs` 2/2 against isolated stack `privacy-bd84d889` (Postgres proves revocation/isolation/preservation/denial); migration `0029` `58efada0…` present only in that worktree — absent at `a201d5d` in `t_6eb0ecda` (`git ls-tree -r a201d5d -- apps/api/src` shows no `privacy*.ts`) | security | User-deletion export/delete boundary, `user_deletion_tombstone` | Land privacy artifact onto main via bounded PR after architecture review; verify coherent Compose with migration `0029` idempotent; human-approval gate per `release-policy.yaml` (`privacy-or-retention-change`). No physical ledger delete. |
| US-0503, US-0705, US-1105, US-1201, US-1401, US-1402, US-1403, US-1404, US-1601 | TC-US-0503-UX, TC-US-0705-UX, TC-US-1105-UX, TC-US-1201-UX, TC-US-1401-UX, TC-US-1402-UX, TC-US-1403-UX, TC-US-1404-UX, TC-US-1601-UX | NOT VERIFIED — UX multi-segment cases exist but no fresh stacked UX run in `t_6eb0ecda` | `c01d481` adds the nine `*-UX` rows (story `US-xxxx`); catalog diff in `git show c01d481 -- test-cases.md`; attribution verified with `git log --oneline -S "TC-US-0503-UX" -- test-cases.md` → `c01d481` | frontend / projections | UX/reporting contracts | Verify against `UI-001` fixture on isolated stack. |
| Remaining 133-parent scope not listed above | Corresponding `TC-US-*` / `TC-US-*-X` per §2 | R / SR / N as per B-004 ledgers (§1) — NOT VERIFIED in `t_6eb0ecda` | B-004 ledgers (`649e756a…`, `4c0cf866…`), `b-004-refinement.md:8` (79/133 historical baseline, 54 remaining Wave 11+), `roadmap.md` revalidations | per `b-004-refinement.md` Owner key | per refinement Dependencies column | Per-refinement "Next safe action" and dependency order; no dispatch ahead of red W0/Poort B gates. |

Notes:

- `TC-US-0203-C` is intentionally mapped to story `US-0203-A` (TOTP replay case sharing the same child fixture); it does not declare a new child `US-0203-C` and is therefore not an "unexpected" missing child in the 118-child inventory. The extra `*-UX`, `TC-US-0802/0803-*`, `TC-US-0201-AUTH` and `TC-US-0203-OIDC-DEPLOY` cases similarly point at their parent/bounded child and do not expand the 133-parent or 118-child counts.
- Of the 133 declared parents, **83 have no declared atomic child**. That figure is *derived*, not subtracted: the 118 declared children are spread over only 50 parents (at most 4 children on one parent), and 133 − 50 = 83. The parent `TC-US-####` row of each such parent is its acceptance case (per the B-004 ledger rule). The earlier figure "15" in this supplement (and in the B-004 ledger `t_73233975`, lines 8 and 157) subtracted 133 parents − 118 children, which is not a parent count: the same ledger's own 133-row table lists 83 rows whose atomic-children column reads `none` (`grep -c '^| US-[0-9]\{4\} | none;'` → 83). For the narrower 54-parent refinement scope of `b-004-refinement.md:8` the equivalent figure is 31 standalone stories + 50 atomic children = 81 work entries.
- The 5 lowercase `TC-US-0802/0803-*` rows (§2.1, commit `24fa997`) belong to the "remaining 133-parent scope" row above; they were not given their own §3 row because no Wave 1 gate handoff claims them.

## 4  What this supplement does and does not authorize

- Does: reconciles inventory (133/118/251 structural, 12 `TC-X-*`, 16 extra multi-segment catalog rows explained), labels `79/133` and `168/168` explicitly historical, maps affected Wave 1 stories to exact TC IDs and evidence SHAs/paths, records dependency/next-gate ordering, and publishes a corrected, executable inventory command whose output is reproduced verbatim in §2.3.
- Does not: mark any story or gate DONE, authorize W0-2/W0-3 implementation, authorize Poort B deployment, authorize production hardening, or approve release. Full local gates (`lint`, `typecheck`, `unit`, `financial-golden`, `integration-contract`, `e2e`, `migration-dry-run`, `restore-replay`, `secret-scan`, `dependency-scan`, `sbom`, `staging-smoke`, `health-window` per `release-policy.yaml` SHA `c77d2826…`) remain NOT VERIFIED in this worktree `t_6eb0ecda` except where explicitly cited isolated handoffs show passing stacked runs.
- W0-2 QA remains intentionally `RED/BLOCKED` per `t_ca53a2ba` artifact SHA `37763f80…`. No financial-policy assumption (cash/quantity signs, cost-basis version, rounding, transfer neutrality, replay/restore equality) is approved beyond the narrow joint D-FEE-TAX-01 scope listed in that artifact.
- Poort B remains `NOT PROVEN / BLOCKED` per `t_0915a5c8` SHA `cf7d971e…`; Poort A remediation is `V-ISOLATED` per `t_1b20f3bd` SHA `2dda93f9…` and approved review `t_4bdf8636` at `a201d5d`, but not yet re-verified on a clean `main` checkout in this worktree.
- Privacy export/delete is `V-ISOLATED` in worktree `t_bd84d889-privacy` and `BLOCKED / NOT VERIFIED` on mainline `t_6eb0ecda` at `a201d5d` (files absent; see §1 SHAs).

## 5  QA review request and correction record

An independent QA review of the first edition was performed in worktree
`t_bb3d0d10` (commit `62eeeda`): report
`docs/backlog/qa-review-b-004-evidence-ledger-supplement-2026-10-20.md`,
evidence under
`.hermes/team/evidence/20261020T1812+0200-qa-b-004-supplement-review/`.
Verdict: **FAIL — CHANGES REQUIRED** on the inventory-only gate, with 9
findings (2 blockers, 2 high, 2 medium, 2 low, 1 info). This corrected edition
answers each of them:

| Finding | Severity | Correction in this edition |
|---|---|---|
| F1 | blocker | §2.3 parent pattern is now `r'(US-\d{4})(?:\s+—\s+.+)?'` with a real capture group; the command runs clean and its verbatim output is pasted in §2.3. |
| F1b | blocker | §2.3 unpacks the `cases` 3-tuples as `(n, tid, story)` before taking the strict structural subset. |
| F2 | high | Census regex widened to any suffix shape and any case (`TC-US-\d{4}(?:-[A-Za-z0-9]+)*`): 263 → **268** story-linked rows, 275 → **280** all catalog rows, 11 → **16** extra ids; the five previously dropped lowercase rows are enumerated in §2 and §2.1. |
| F3 | high | The nine `TC-US-*-UX` rows are attributed to `c01d481` (not `24fa997`) in §2.1 and §3; the §3 pointer is now `git show c01d481 -- test-cases.md`, and `24fa997` is correctly credited with the five lowercase `TC-US-0802/0803-*` rows. |
| F4 | medium | §2.1 now explains the `cf5e8c4` vs `a201d5d` baseline difference, the ` — Title` suffix added by `60acd99` that makes the archived filter lose US-1504/1505/1506, and reconciles the audit's "263 all catalog rows" with this document's 280. |
| F5 | medium | The subtracted "15 parents" is replaced by the derived **83** parents without a declared atomic child (133 parents − 50 parents that own a child); the 31-standalone figure of the 54-parent refinement scope is quoted separately as the narrower scope figure. |
| F6 | low | The §1 hash table now carries the SHA-256 `9ff4260e…` for the `t_adb50ce5` report; the gate note moved to the location column. |
| F7 | low | The US-0201 row no longer carries a literal `?`: the offline figure is stated as 582 tests / 441 pass / 0 fail / 141 skipped and the `STACK_SMOKE=1` runtime baseline at `a201d5d` as 582 tests / 534 pass / 47 fail / 1 skipped; both are labelled NOT VERIFIED as runtime gates in this worktree. |
| F8 | info | §3 now says `ca1c9a5` *modified* the pre-existing `TC-US-0202` row (and `TC-US-0203-B`), citing `git log --oneline -S "TC-US-0202" -- test-cases.md` → `cf5e8c4`. |

Independent QA re-review of this corrected edition against the pinned `a201d5d`
SHAs is requested. The review should record PASS/FAIL/BLOCKED with exact SHAs
cited under `docs/backlog/` or `.hermes/team/`.

The independent audit referenced in §2.1 remains at
`/Users/ruben/spaartrack/.worktrees/t_aad17517/docs/backlog/independent-133-story-traceability-audit.md`
SHA `6177ff335f36…` (104 lines, earlier snapshot at `cf5e8c4`, 251/251 clean).

## 6  Reproducibility and trace/correlation IDs

- Reproducible inventory: run the Python snippet in §2.3 from repository root
  in this worktree `t_6eb0ecda` at `a201d5d` (or in `t_f3781eaa` at `c8e6d9a`,
  whose `roadmap.md`/`test-cases.md` are byte-identical); standard library
  only, exit status 0, output reproduced verbatim in §2.3.
- Contract: `tests/smoke/b-004-inventory-census-contract.test.mjs` (always
  green, derived from `roadmap.md` + `test-cases.md` only) and
  `tests/smoke/b-004-supplement-figures-contract.test.mjs` (red-first, asserts
  the published figures of this document against that same canonical census).
  Both were added by the QA review `t_bb3d0d10` and are not weakened here.
- No application request, provider call, job, or agent run was executed in this
  documentation-only supplement; no `TRACE_ID`/`CORRELATION_ID` applies.
  Cited Poort A/B handoffs used trace IDs `qa-1b20f3bd-*`,
  `qa-adb50ce5-baseline-*`, `t_4bdf8636-red/green/suite-*` as recorded in their
  artifacts.

## 7  Migration and boundary implications

- No schema, migration, event, fixture, or source change in this task.
- Any future schema/event change requires architecture review and
  backward-compatible `expand/contract` with dry-run/restore evidence before
  dependent implementation (per `AGENTS.md` and `release-policy.yaml`
  `requiredChecks`).
- Financial invariants, cost-basis/versioning, transfer neutrality, correction/
  VOID, replay determinism, and restore equality remain unimplemented/unverified
  in this worktree.

---

Evidence ledger supplement prepared by architecture for task `t_6eb0ecda`;
corrected edition by architecture for task `t_f3781eaa` after QA review
`t_bb3d0d10`.
