// Behavioral test utilities for Wave 0 (US-0001..US-0005)
// Loads synthetic fixtures and simulates cross-service logic deterministically.

import fs from "node:fs";
import path from "node:path";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../../fixtures");

export function loadFixture(name) {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, `${name}.json`), "utf8")
  );
}

export const ENV = loadFixture("ENV-001");
export const SEC = loadFixture("SEC-001");
export const LEDGER = loadFixture("LEDGER-001");
export const CALC = loadFixture("CALC-001");
export const UI = loadFixture("UI-001");
