const VARIABLE = "SYNTHETIC_FIXTURE_KEY";

export function fixtureKey() {
  const key = process.env[VARIABLE];
  if (!key) {
    throw new Error(
      `${VARIABLE} is required for fixture-session tests; run \`cp .env.example .env\` and export it before running the tests`
    );
  }
  return key;
}

export function fixtureHeaders(extra = {}) {
  return { ...extra, "x-synthetic-fixture-key": fixtureKey() };
}
