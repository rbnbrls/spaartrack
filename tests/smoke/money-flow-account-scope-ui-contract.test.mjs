import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const html = readWebSource();

test("TC-US-0901-UI: onboarding exposes opt-in Money Flow account scope", () => {
  for (const value of [
    "money-flow-scope-panel",
    "money-flow-scope-list",
    "Money Flow accounts",
    "/api/v1/money-flow/account-scope",
    "is_enabled",
    "bank-, cash- en creditcardaccounts"
  ]) assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
});
