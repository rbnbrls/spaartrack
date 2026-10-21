import test from "node:test";
import assert from "node:assert/strict";

import {
  apiUrl,
  webUrl,
  s3Endpoint,
  databaseUrl,
  endpointConfiguration,
  resolveEndpoint,
} from "../support/local-endpoints.mjs";

test("local endpoint resolver uses documented defaults", () => {
  const environmentIndependentDefaults = {};
  assert.equal(resolveEndpoint("api", environmentIndependentDefaults).url, "http://localhost:18080");
  assert.equal(resolveEndpoint("web", environmentIndependentDefaults).url, "http://localhost:3000");
  assert.equal(resolveEndpoint("s3", environmentIndependentDefaults).url, "http://localhost:19000");
  assert.equal(resolveEndpoint("database", environmentIndependentDefaults).url, "postgres://spaartrack:***@localhost:55432/spaartrack");
});

test("local endpoint resolver exposes the override variable for each endpoint", () => {
  assert.deepEqual(endpointConfiguration("api"), {
    name: "API",
    url: apiUrl,
    override: "API_URL",
  });
  assert.deepEqual(endpointConfiguration("web"), {
    name: "web",
    url: webUrl,
    override: "WEB_URL",
  });
  assert.deepEqual(endpointConfiguration("s3"), {
    name: "object storage",
    url: s3Endpoint,
    override: "S3_ENDPOINT",
  });
  assert.deepEqual(endpointConfiguration("database"), {
    name: "SQL database",
    url: databaseUrl,
    override: "DATABASE_URL",
  });
});
