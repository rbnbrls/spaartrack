import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const html = readWebSource();

const communityPanel = () => html.match(/<section[^>]*id="community-feed-panel"[\s\S]*?<\/form><\/section>/)?.[0] ?? "";

test("TC-US-1608-UX: Community page has a clear hierarchy and privacy overview", () => {
  const panel = communityPanel();
  assert.match(panel, /aria-labelledby="community-feed-page-title"/);
  assert.match(panel, /id="community-feed-page-title"[^>]*>Community zonder dataprivacy-lek<\/h1>/);
  for (const marker of ["community-feed-public", "community-feed-private", "community-feed-moderation", "community-feed-export-status"]) {
    assert.match(panel, new RegExp(`id="${marker}"`), `${marker} overview metric is required`);
  }
  assert.match(panel, /id="community-feed-privacy-note"[^>]*role="note"/);
});

test("TC-US-1608-UX: Community controls are labeled, gated and expose explicit states", () => {
  const panel = communityPanel();
  for (const id of ["community-feed-visibility", "community-feed-title", "community-feed-body"]) {
    assert.match(panel, new RegExp(`for="${id}"`), `${id} needs a visible label`);
  }
  for (const id of ["community-feed-loading", "community-feed-empty", "community-feed-error"]) {
    assert.match(panel, new RegExp(`id="${id}"`), `${id} state is required`);
  }
  for (const id of ["community-feed-submit", "community-feed-moderate", "community-feed-delete", "community-feed-export"]) {
    assert.match(panel, new RegExp(`id="${id}"[^>]*disabled`), `${id} must be gated before a fixture/post exists`);
  }
  assert.match(panel, /community-feed-form.*aria-describedby="community-feed-error"/s);
});

test("TC-US-1608-UX: Community feed has a non-colour data alternative and trace evidence", () => {
  const panel = communityPanel();
  assert.match(panel, /id="community-feed-table"[\s\S]*scope="col"/);
  assert.match(panel, /id="community-feed-table-empty"/);
  for (const id of ["community-feed-trace-id", "community-feed-correlation-id"]) {
    assert.match(panel, new RegExp(`id="${id}"`), `${id} must be visible`);
  }
  assert.match(html, /function setCommunityFeedError/);
  assert.match(html, /community-feed-moderate.*catch\(error=>setCommunityFeedError\(error\)\)/s);
  assert.match(html, /community-feed-delete.*catch\(error=>setCommunityFeedError\(error\)\)/s);
  assert.match(html, /community-feed-export.*catch\(error=>setCommunityFeedError\(error\)\)/s);
});

test("TC-US-1608-UX: Community controls keep touch targets and keyboard focus visible", () => {
  assert.match(html, /\.route-panel \.btn[^\{]*\{[^}]*min-height:44px/);
  assert.match(html, /\.route-panel \.select[^\{]*\{[^}]*min-height:44px/);
  assert.match(html, /community-feed-panel[\s\S]*aria-live="polite"/);
});
