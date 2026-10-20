import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readWebSource } from "../helpers/web-source.mjs";

const html = readWebSource();

test("TC-US-0705-UX: Calendar overview follows the canonical calendar interaction contract", () => {
  assert.match(html, /id="calendar-overview-panel"[^>]*data-route="Calendar"/);
  assert.match(html, /<h1[^>]*>Calendar \/ Overview<\/h1>/);
  for (const id of ["calendar-period-month", "calendar-period-week", "calendar-prev", "calendar-next", "calendar-today", "calendar-event-filter", "calendar-view-status", "calendar-events-table"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const type of ["ALL", "EX_DIVIDEND", "DIVIDEND_PAYMENT", "AGM", "EARNINGS", "ECONOMIC"]) {
    assert.match(html, new RegExp(`value="${type}"`));
  }
  assert.match(html, /id="calendar-grid"[^>]*role="grid"/);
  assert.match(html, /id="calendar-empty-day"/);
  assert.match(html, /id="calendar-events-table"[\s\S]*scope="col"/);
});

test("TC-US-0705-UX: Calendar has accessible state, traceability and resilient interaction wiring", () => {
  assert.match(html, /id="calendar-overview-panel"[\s\S]*trace-id[\s\S]*correlation-id/);
  assert.match(html, /id="calendar-view-status"[^>]*role="status"/);
  assert.match(html, /id="calendar-event-filter"[^>]*aria-label="Eventtype"/);
  assert.match(html, /function renderCalendarOverview/);
  for (const id of ["calendar-prev", "calendar-next", "calendar-today", "calendar-event-filter", "calendar-period-month", "calendar-period-week"]) {
    assert.match(html, new RegExp(`${id}[\\s\\S]*addEventListener`));
  }
  assert.match(html, /calendar-overview-v1/);
  assert.match(html, /calendar-events-v1/);
});
