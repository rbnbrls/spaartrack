import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { capabilitiesForScope } from "../../apps/api/src/agent-scopes.ts";

describe("US-1605 agent scopes", () => {
  it("RESTRICTED_VIEW geeft alleen relatieve capabilities", () => {
    const caps = capabilitiesForScope("RESTRICTED_VIEW");
    assert.deepEqual(caps, ["read_relative"]);
  });
  it("VIEW/PROPOSE/MANAGE bouwen hiërarchisch op", () => {
    assert.ok(capabilitiesForScope("VIEW").includes("read_relative"));
    assert.ok(capabilitiesForScope("PROPOSE").includes("propose"));
    assert.ok(capabilitiesForScope("MANAGE").includes("manage_scopes"));
    assert.ok(!capabilitiesForScope("VIEW").includes("propose"));
  });
});
