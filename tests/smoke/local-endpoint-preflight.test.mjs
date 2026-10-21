import test from "node:test";

import { assertExpectedStackReachable } from "../support/local-endpoints.mjs";

const runtimeStackRequired = process.env.STACK_SMOKE === "1" ||
  process.env.SCHEMA_BOOTSTRAP_RUNTIME === "1" ||
  process.env.BROKER_RUNTIME_TEST === "1";

test("LOCAL_ENDPOINT_PREFLIGHT: expected local stack endpoints are reachable", { skip: !runtimeStackRequired }, async () => {
  const keys = process.env.STACK_SMOKE === "1" ? undefined : ["database"];
  await assertExpectedStackReachable(keys);
});
