import test from "node:test";
import assert from "node:assert/strict";

const helperUrl = new URL("../helpers/fixture-key.mjs", import.meta.url);

async function importHelper(key) {
  if (key === undefined) delete process.env.SYNTHETIC_FIXTURE_KEY;
  else process.env.SYNTHETIC_FIXTURE_KEY = key;
  return import(`${helperUrl.href}?key=${encodeURIComponent(key ?? "unset")}`);
}

test("fixture key helper resolves the provisioned environment value", async () => {
  const previous = process.env.SYNTHETIC_FIXTURE_KEY;
  try {
    const { fixtureKey, fixtureHeaders } = await importHelper("synthetic-ci-key");
    assert.equal(fixtureKey(), "synthetic-ci-key");
    assert.deepEqual(fixtureHeaders({ "content-type": "application/json" }), {
      "content-type": "application/json",
      "x-synthetic-fixture-key": "synthetic-ci-key",
    });
  } finally {
    if (previous === undefined) delete process.env.SYNTHETIC_FIXTURE_KEY;
    else process.env.SYNTHETIC_FIXTURE_KEY = previous;
  }
});

test("fixture key helper fails loudly when the environment value is absent", async () => {
  const previous = process.env.SYNTHETIC_FIXTURE_KEY;
  try {
    const { fixtureKey } = await importHelper(undefined);
    assert.throws(
      () => fixtureKey(),
      /SYNTHETIC_FIXTURE_KEY is required for fixture-session tests; run `cp \.env\.example \.env` and export it before running the tests/
    );
  } finally {
    if (previous === undefined) delete process.env.SYNTHETIC_FIXTURE_KEY;
    else process.env.SYNTHETIC_FIXTURE_KEY = previous;
  }
});
