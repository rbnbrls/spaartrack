import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/community-feed.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1608: public/private boundary, moderation and deletion/export are explicit", () => {
  for (const marker of ["communityFeedRoute", "buildCommunityPost", "moderateCommunityPost", "buildCommunityExport", "community_post", "PUBLIC", "PRIVATE", "MODERATION", "DELETED", "trace_id", "correlation_id"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  for (const marker of ["community-feed-panel", "community-feed-form", "prepare-community-feed", "community-feed-submit", "community-feed-moderate", "community-feed-delete", "community-feed-export", "community-feed-evidence", "community-feed-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-1608 runtime: authenticated owner can create, moderate, delete and export synthetic content", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-community-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Community" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": fixtureKey() }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}`, "x-trace-id": "trace-community-1608", "x-correlation-id": "corr-community-1608" };
  const createRes = await fetch(`${base}/api/v1/community/posts`, { method: "POST", headers: auth, body: JSON.stringify({ visibility: "PUBLIC", title: "Synthetic feed post", body: "Synthetic community evidence", public_metrics: { allocation_percent: 62.5 } }) });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.status, "VISIBLE");
  assert.equal(created.public_metrics.amount, undefined);
  const feedRes = await fetch(`${base}/api/v1/community/feed`, { headers: { "x-trace-id": "trace-community-feed-1608" } });
  assert.equal(feedRes.status, 200);
  const feed = await feedRes.json();
  const matching = feed.posts.filter((post) => post.id === created.id);
  assert.equal(matching.length, 1, "created public post must appear EXACTLY ONCE in the public feed");
  const createdInFeed = matching[0];
  assert.equal(createdInFeed.visibility, "PUBLIC");
  assert.equal(createdInFeed.public_metrics.amount, undefined);
  assert.equal(feed.count, feed.posts.length, "feed.count must equal the number of posts in the returned array");
  const moderateRes = await fetch(`${base}/api/v1/community/posts/${created.id}/moderate`, { method: "POST", headers: auth, body: JSON.stringify({ decision: "APPROVE" }) });
  assert.equal(moderateRes.status, 200);
  const deleteRes = await fetch(`${base}/api/v1/community/posts/${created.id}/delete`, { method: "POST", headers: auth });
  assert.equal(deleteRes.status, 200);
  const exportRes = await fetch(`${base}/api/v1/community/export`, { headers: auth });
  assert.equal(exportRes.status, 200);
  assert.equal((await exportRes.json()).calculation_version, "community-export-v1");
});
