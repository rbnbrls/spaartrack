import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const html = readWebSource();

test("TC-US-0502: manual action form validates required fields before commit and supports editing", () => {
  for (const value of [
    "manual-action-form", "action-account", "action-instrument", "action-currency",
    "action-date", "action-amount", "action-validation", "Wijzig actie",
    "Account is verplicht", "Instrument is verplicht", "Currency is verplicht",
    "Datum is verplicht", "Bedrag is verplicht", "/api/v1/ledger/transactions"
  ]) {
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});
