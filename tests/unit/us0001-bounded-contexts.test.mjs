import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const CONTEXTS = [
  "Ledger",
  "Integrations",
  "Market Data",
  "Income",
  "Performance",
  "Money Flow",
  "Tax",
  "Reporting",
  "AI",
  "Operations",
];

test("US-0001: bounded contexts zijn versioned vastgelegd", () => {
  const adrDir = new URL("../../docs/adr/", import.meta.url);
  const files = fs.readdirSync(adrDir).filter((f) => f.endsWith(".md"));
  const corpus = files
    .map((f) => fs.readFileSync(new URL(f, adrDir), "utf8"))
    .join("\n");
  for (const ctx of CONTEXTS) {
    assert.match(
      corpus,
      new RegExp(ctx.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      `bounded context ontbreekt: ${ctx}`
    );
  }
});
