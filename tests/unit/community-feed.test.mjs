import test from "node:test";
import assert from "node:assert/strict";
import { buildCommunityPost, moderateCommunityPost, buildCommunityExport } from "../../apps/api/src/community-feed.ts";

test("US-1608 unit: public post exposes only safe relative data", () => {
  const post = buildCommunityPost({
    visibility: "PUBLIC",
    title: "Synthetic monthly update",
    body: "A calm synthetic update.",
    public_metrics: { allocation_percent: 62.5, return_percent: 4.2 }
  }, "2026-10-18T12:00:00.000Z");
  assert.equal(post.visibility, "PUBLIC");
  assert.equal(post.status, "VISIBLE");
  assert.equal(post.public_metrics.allocation_percent, 62.5);
  assert.equal(post.read_only, true);
  assert.equal(post.calculation_version, "community-feed-v1");
  assert.equal("amount" in post.public_metrics, false);
});

test("US-1608 unit: private post never becomes public and moderation is server-side", () => {
  const post = buildCommunityPost({ visibility: "PRIVATE", title: "Private note", body: "Synthetic private note." }, "2026-10-18T12:00:00.000Z");
  assert.equal(post.status, "PRIVATE");
  assert.equal(moderateCommunityPost({ body: "Synthetic private note.", visibility: "PRIVATE" }).status, "PRIVATE");
  assert.throws(() => buildCommunityPost({ visibility: "PUBLIC", title: "Leak", body: "Synthetic", public_metrics: { amount: 100 } }, "2026-10-18T12:00:00.000Z"), /PRIVATE_DATA_IN_PUBLIC_POST/);
});

test("US-1608 unit: moderation rejects blocked content and export excludes deleted posts", () => {
  assert.equal(moderateCommunityPost({ visibility: "PUBLIC", body: "Synthetic spam promotion" }).status, "REJECTED");
  const exported = buildCommunityExport([
    { id: "1", visibility: "PUBLIC", status: "VISIBLE", title: "one", body: "safe" },
    { id: "2", visibility: "PRIVATE", status: "PRIVATE", title: "two", body: "private" },
    { id: "3", visibility: "PUBLIC", status: "DELETED", title: "three", body: "deleted" }
  ]);
  assert.deepEqual(exported.posts.map((post) => post.id), ["1", "2"]);
  assert.equal(exported.calculation_version, "community-export-v1");
});
