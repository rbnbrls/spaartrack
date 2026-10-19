import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const ux = readFileSync(new URL("docs/ux-guidelines.md", root), "utf8");

test("TC-US-0503-UX: UX rules define the canonical calm dense-finance presentation contract", () => {
  for (const marker of [
    "één duidelijke informatiehiërarchie",
    "vaste applicatiestructuur",
    "financiële dichtheid met visuele rust",
    "WCAG AA",
    "tabulaire cijfers",
    "tabelalternatief",
    "loading",
    "geen data",
    "fout",
    "44 × 44",
    "Geen betekenis uitsluitend via kleur",
    "trace- en correlation-ID",
    "canonical ledger",
    "dense financial information, presented with calm visual hierarchy",
  ]) {
    assert.match(ux, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")), marker);
  }
});

test("TC-US-0503-UX: UX rules preserve page order and financial status distinctions", () => {
  const order = [
    "Globale navigatie",
    "Kerncijfers",
    "Visuele samenvatting",
    "Filter- en segmentatieopties",
    "Gedetailleerde tabel",
    "Secundaire of historische informatie",
  ];

  let previous = -1;
  for (const marker of order) {
    const current = ux.indexOf(marker);
    assert.ok(current > previous, `${marker} must follow the defined information hierarchy`);
    previous = current;
  }

  for (const marker of ["Werkelijke", "verwachte", "historische", "percentage", "teken of icoon"]) {
    assert.match(ux, new RegExp(marker), marker);
  }
});
