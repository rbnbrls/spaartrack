import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const html = readWebSource();
const api = readFileSync(new URL("../../apps/api/src/index.ts", import.meta.url), "utf8");

test("TC-US-1201-UX: Performance page owns its hierarchy and does not leak portfolio filters", () => {
  assert.match(html, /module-nav-label">\$\{active\} modules/, "Module navigation needs a page-specific label");
  assert.match(html, /data-route=\"Performance\"[^>]*aria-labelledby=\"performance-page-title\"/, "Performance needs a named page region");
  assert.match(html, /id=\"performance-page-title\"[^>]*>Performance<\//, "Performance needs a visible page heading");
  assert.match(html, /portfolio-filters[^\n]*data-route=\"Portfolio\"/, "Portfolio filters must be scoped to the Portfolio route");
});

test("TC-US-1201-UX: Risk results expose traceability without browser logging noise", () => {
  assert.match(html, /id=\"risk-trace-id\"/, "Risk result needs trace evidence");
  assert.match(html, /id=\"risk-correlation-id\"/, "Risk result needs correlation evidence");
  assert.match(html, /response\.headers\.get\('x-trace-id'\)/, "API calls must retain response trace IDs");
  assert.match(api, /risk_metrics_failed.*trace_id.*correlation_id/s, "Risk failures must be logged with traceability");
});
