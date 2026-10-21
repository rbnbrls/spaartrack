import test from "node:test";

import { assertExpectedStackReachable } from "../support/local-endpoints.mjs";

test("LOCAL_ENDPOINT_PREFLIGHT: expected local stack endpoints are reachable", { skip: !process.env.STACK_SMOKE }, async () => {
  await assertExpectedStackReachable();
});
