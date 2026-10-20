import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readWebSource } from "../helpers/web-source.mjs";

const html = readWebSource();
const api = readFileSync(new URL("../../apps/api/src/index.ts", import.meta.url), "utf8");

test("TC-US-1601-UX: Money Flow questions page has a named read-only hierarchy", () => {
  assert.match(html, /id="assistant-answer-panel"[^>]*data-route="Money Flow"[^>]*aria-labelledby="money-flow-questions-title"/);
  assert.match(html, /id="money-flow-questions-title"[^>]*>Money Flow \/ Vragen<\//);
  assert.match(html, /id="money-flow-question-period"/);
  assert.match(html, /id="money-flow-question-data-as-of"/);
  assert.match(html, /id="assistant-answer-empty"/);
  assert.match(html, /id="assistant-answer-error"/);
  assert.match(html, /id="assistant-answer-table"/);
});

test("TC-US-1601-UX: Money Flow question controls are keyboard-safe and traceable", () => {
  assert.match(html, /id="assistant-answer-reset"/);
  assert.match(html, /id="assistant-answer-status"[^>]*role="status"/);
  assert.match(html, /id="assistant-answer-trace-id"/);
  assert.match(html, /id="assistant-answer-correlation-id"/);
  assert.match(html, /assistant-answer-reset[\s\S]*addEventListener/);
  assert.match(html, /assistant-answer-form[\s\S]*addEventListener\('submit'/);
  assert.match(api, /assistant_answer_failed.*trace_id.*correlation_id/s);
});
