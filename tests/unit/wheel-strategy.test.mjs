import test from "node:test";
import assert from "node:assert/strict";
import { planWheelCycle } from "../../apps/api/src/wheel-strategy.ts";

test("US-1406 unit: wheel cycle links put, assignment, covered call and called-away", () => {
  const cycle = planWheelCycle({
    events: [
      { leg: "PUT_OPEN", option_type: "PUT", quantity: 1, premium: 2.5, strike: 100, occurred_at: "2026-01-05" },
      { leg: "PUT_ASSIGNMENT", option_type: "PUT", quantity: 1, strike: 100, occurred_at: "2026-02-01" },
      { leg: "CALL_OPEN", option_type: "CALL", quantity: 1, premium: 3, strike: 105, occurred_at: "2026-02-03" },
      { leg: "CALL_CALLED_AWAY", option_type: "CALL", quantity: 1, strike: 105, occurred_at: "2026-03-01" }
    ]
  });
  assert.equal(cycle.stages.length, 4);
  assert.deepEqual(cycle.stages.map((s) => s.stage), ["CASH_SECURED_PUT", "ASSIGNED_SHARES", "COVERED_CALL", "CALLED_AWAY"]);
  assert.equal(cycle.linked, true);
  assert.equal(cycle.calculation_version, "wheel-strategy-v1");
  assert.equal(cycle.read_only, true);
});

test("US-1406 unit: broken wheel chain is flagged unlinked", () => {
  const cycle = planWheelCycle({
    events: [{ leg: "CALL_OPEN", option_type: "CALL", quantity: 1, premium: 3, strike: 105, occurred_at: "2026-02-03" }]
  });
  assert.equal(cycle.linked, false);
  assert.equal(cycle.stages[0].stage, "COVERED_CALL");
});

test("US-1406 unit: roll keeps the wheel cycle linked", () => {
  const cycle = planWheelCycle({
    events: [
      { leg: "PUT_OPEN", option_type: "PUT", quantity: 1, premium: 2.5, strike: 100, occurred_at: "2026-01-05" },
      { leg: "PUT_ROLL", option_type: "PUT", quantity: 1, premium: 2, strike: 95, occurred_at: "2026-01-20" },
      { leg: "PUT_ASSIGNMENT", option_type: "PUT", quantity: 1, strike: 95, occurred_at: "2026-02-01" }
    ]
  });
  assert.equal(cycle.linked, true);
  assert.equal(cycle.stages[1].stage, "PUT_ROLL");
});
