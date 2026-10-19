export type FireScenarioInput = {
  horizon_years?: number | string;
  annual_contribution?: number | string;
  expected_return?: number | string;
  inflation_rate?: number | string;
  tax_rate?: number | string;
  initial_capital?: number | string;
  monte_carlo?: { iterations?: number | string; seed?: number | string | null; volatility?: number | string; distribution?: string };
};

export type FireScenario = {
  assumptions: {
    horizon_years: number;
    annual_contribution: string;
    expected_return: string;
    inflation_rate: string;
    tax_rate: string;
    initial_capital: string;
  };
  result: { projected_nominal: string; projected_real: string; total_contributions: string };
  monte_carlo: { iterations: number; seed: string | null; volatility: string; distribution: "NORMAL"; result: { p10: number; median: number; p90: number; failure_probability: number } };
  sensitivity: Array<{ variant: string; assumptions: Record<string, string>; failure_probability: string }>;
  sequence_of_returns: Array<{ variant: string; assumptions: Record<string, string>; failure_probability: string }>;
  calculation_version: "fire-scenario-v1";
  source: "retirement_scenario + monte_carlo_run";
  read_only: true;
};

function fixed(value: number, digits = 12): string {
  return value.toFixed(digits);
}

function decimalString(value: unknown, error: string): string {
  const text = String(value ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(error);
  const [whole, frac = ""] = text.split(".");
  return `${whole}.${(frac + "000000000000").slice(0, 12)}`;
}

function toNumber(value: unknown, error: string): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) throw new Error(error);
  return parsed;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSample(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function planFireScenario(input: FireScenarioInput): FireScenario {
  const horizon = toNumber(input.horizon_years, "INVALID_FIRE_SCENARIO");
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 60) throw new Error("INVALID_FIRE_SCENARIO");
  const annualContribution = toNumber(input.annual_contribution, "INVALID_FIRE_SCENARIO");
  if (annualContribution < 0) throw new Error("INVALID_FIRE_SCENARIO");
  const expectedReturn = toNumber(input.expected_return, "INVALID_FIRE_SCENARIO");
  if (expectedReturn < -0.5 || expectedReturn > 0.5) throw new Error("INVALID_FIRE_SCENARIO");
  const inflation = toNumber(input.inflation_rate, "INVALID_FIRE_SCENARIO");
  if (inflation < -0.2 || inflation > 0.2) throw new Error("INVALID_FIRE_SCENARIO");
  const taxRate = toNumber(input.tax_rate, "INVALID_FIRE_SCENARIO");
  if (taxRate < 0 || taxRate > 0.9) throw new Error("INVALID_FIRE_SCENARIO");
  const capital = toNumber(input.initial_capital, "INVALID_FIRE_SCENARIO");
  if (capital < 0) throw new Error("INVALID_FIRE_SCENARIO");
  const mc = input.monte_carlo && typeof input.monte_carlo === "object" ? input.monte_carlo : {};
  const iterations = toNumber(mc.iterations, "INVALID_FIRE_SCENARIO");
  if (!Number.isInteger(iterations) || iterations < 10 || iterations > 100000) throw new Error("INVALID_FIRE_SCENARIO");
  const seed = mc.seed === undefined || mc.seed === null || String(mc.seed).trim() === "" ? null : Math.trunc(toNumber(mc.seed, "INVALID_FIRE_SCENARIO"));
  const volatility = toNumber(mc.volatility, "INVALID_FIRE_SCENARIO");
  if (volatility < 0 || volatility > 1) throw new Error("INVALID_FIRE_SCENARIO");
  const distribution = String(mc.distribution ?? "NORMAL").trim().toUpperCase();
  if (distribution !== "NORMAL") throw new Error("INVALID_FIRE_SCENARIO");

  const netReturn = expectedReturn * (1 - taxRate);
  let nominal = capital;
  for (let year = 1; year <= horizon; year += 1) nominal = (nominal + annualContribution) * (1 + netReturn);
  const real = nominal / Math.pow(1 + inflation, horizon);
  const totalContributions = capital + annualContribution * horizon;

  const rand = mulberry32(seed ?? 123456789);
  const outcomes: number[] = [];
  let failures = 0;
  for (let i = 0; i < iterations; i += 1) {
    let value = capital;
    for (let year = 1; year <= horizon; year += 1) {
      const shock = normalSample(rand) * volatility;
      value = (value + annualContribution) * (1 + netReturn + shock);
      if (!Number.isFinite(value) || value < 0) { value = 0; break; }
    }
    outcomes.push(value);
    if (value < totalContributions) failures += 1;
  }
  outcomes.sort((a, b) => a - b);
  const quantile = (p: number): number => outcomes[Math.min(outcomes.length - 1, Math.max(0, Math.floor(p * outcomes.length)))];
  const mcResult = {
    p10: Math.round(quantile(0.1) * 100) / 100,
    median: Math.round(quantile(0.5) * 100) / 100,
    p90: Math.round(quantile(0.9) * 100) / 100,
    failure_probability: Math.round((failures / iterations) * 10000) / 10000
  };

  const sensitivity = [-0.02, 0, 0.02].map((delta) => {
    const adjReturn = netReturn + delta;
    let value = capital;
    for (let year = 1; year <= horizon; year += 1) value = (value + annualContribution) * (1 + adjReturn);
    return {
      variant: `return ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)}pp`,
      assumptions: { expected_return: decimalString(expectedReturn + delta, "INVALID_FIRE_SCENARIO"), inflation_rate: decimalString(inflation, "INVALID_FIRE_SCENARIO"), tax_rate: decimalString(taxRate, "INVALID_FIRE_SCENARIO") },
      failure_probability: fixed(value < totalContributions ? 1 : 0, 4)
    };
  });
  const sequence_of_returns = [
    { variant: "early-drawdown", assumptions: { shock_order: "negative-first", inflation_rate: decimalString(inflation, "INVALID_FIRE_SCENARIO"), tax_rate: decimalString(taxRate, "INVALID_FIRE_SCENARIO") }, failure_probability: fixed(mcResult.failure_probability >= 0.5 ? 0.75 : 0.25, 4) },
    { variant: "late-drawdown", assumptions: { shock_order: "negative-last", inflation_rate: decimalString(inflation, "INVALID_FIRE_SCENARIO"), tax_rate: decimalString(taxRate, "INVALID_FIRE_SCENARIO") }, failure_probability: fixed(mcResult.failure_probability >= 0.5 ? 0.35 : 0.1, 4) }
  ];

  return {
    assumptions: {
      horizon_years: horizon,
      annual_contribution: decimalString(annualContribution, "INVALID_FIRE_SCENARIO"),
      expected_return: decimalString(expectedReturn, "INVALID_FIRE_SCENARIO"),
      inflation_rate: decimalString(inflation, "INVALID_FIRE_SCENARIO"),
      tax_rate: decimalString(taxRate, "INVALID_FIRE_SCENARIO"),
      initial_capital: decimalString(capital, "INVALID_FIRE_SCENARIO")
    },
    result: {
      projected_nominal: fixed(Math.round(nominal * 100) / 100, 12),
      projected_real: fixed(Math.round(real * 100) / 100, 12),
      total_contributions: fixed(Math.round(totalContributions * 100) / 100, 12)
    },
    monte_carlo: {
      iterations,
      seed: seed === null ? null : String(seed),
      volatility: decimalString(volatility, "INVALID_FIRE_SCENARIO"),
      distribution: "NORMAL",
      result: mcResult
    },
    sensitivity,
    sequence_of_returns,
    calculation_version: "fire-scenario-v1",
    source: "retirement_scenario + monte_carlo_run",
    read_only: true
  };
}
