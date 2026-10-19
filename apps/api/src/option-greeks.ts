export type OptionGreeksInput = {
  optionType?: string;
  option_type?: string;
  strikePrice?: number | string;
  strike_price?: number | string;
  spotPrice?: number | string;
  spot_price?: number | string;
  volatility?: number | string;
  impliedVolatility?: number | string;
  implied_volatility?: number | string;
  riskFreeRate?: number | string;
  risk_free_rate?: number | string;
  dividendYield?: number | string;
  dividend_yield?: number | string;
  asOf?: string;
  as_of?: string;
  expiryAt?: string;
  expiry_at?: string;
  contractMultiplier?: number | string;
  contract_multiplier?: number | string;
};

const MS_PER_DAY = 86400000;
const OPTION_TYPES = ["CALL", "PUT"];
const fixed = (value: number): string => value.toFixed(12);

function toNumber(value: unknown, error: string): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) throw new Error(error);
  return parsed;
}

function parseInstant(value: string, error: string): number {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(error);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? new Date(`${trimmed}T00:00:00.000Z`) : new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new Error(error);
  return date.getTime();
}

function erfSeries(x: number): number {
  const scale = 2 / Math.sqrt(Math.PI);
  const x2 = x * x;
  let term = x;
  let sum = 0;
  for (let n = 0; n < 400; n += 1) {
    sum += term / (2 * n + 1);
    term = -term * x2 / (n + 1);
    if (Math.abs(term) < 1e-21) break;
  }
  return scale * sum;
}

function erfcContinuedFraction(x: number): number {
  const tiny = 1e-300;
  let f = tiny;
  let c = f;
  let d = 0;
  for (let n = 0; n < 500; n += 1) {
    const a = n === 0 ? 1 : n / 2;
    d = x + a * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = x + a / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-17) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) * f;
}

function erf(x: number): number {
  if (x === 0) return 0;
  const u = Math.abs(x);
  if (u < 1) return x < 0 ? -erfSeries(u) : erfSeries(u);
  const erfU = 1 - erfcContinuedFraction(u);
  return x < 0 ? -erfU : erfU;
}

function normalCdf(t: number): number {
  return 0.5 * (1 + erf(t / Math.sqrt(2)));
}

function normalPdf(t: number): number {
  return Math.exp(-t * t / 2) / Math.sqrt(2 * Math.PI);
}

export function calculateOptionGreeks(input: OptionGreeksInput) {
  const error = "INVALID_OPTION_GREEKS_INPUT";
  const raw = (input ?? {}) as Record<string, unknown>;
  const optionType = String(raw.optionType ?? raw.option_type ?? "").trim().toUpperCase();
  const strikePrice = toNumber(raw.strikePrice ?? raw.strike_price ?? NaN, error);
  const spotPrice = toNumber(raw.spotPrice ?? raw.spot_price ?? NaN, error);
  const volatility = toNumber(raw.volatility ?? raw.impliedVolatility ?? raw.implied_volatility ?? NaN, error);
  const riskFreeRate = toNumber(raw.riskFreeRate ?? raw.risk_free_rate ?? NaN, error);
  const dividendYield = toNumber(raw.dividendYield ?? raw.dividend_yield ?? 0, error);
  const contractMultiplier = toNumber(raw.contractMultiplier ?? raw.contract_multiplier ?? 100, error);

  if (!OPTION_TYPES.includes(optionType)) throw new Error(error);
  if (!(strikePrice > 0)) throw new Error(error);
  if (!(spotPrice > 0)) throw new Error(error);
  if (!(volatility > 0 && volatility <= 5)) throw new Error(error);
  if (!(contractMultiplier > 0)) throw new Error(error);

  const asOfMs = parseInstant(String(raw.asOf ?? raw.as_of ?? ""), error);
  const expiryMs = parseInstant(String(raw.expiryAt ?? raw.expiry_at ?? ""), error);
  const timeToExpiryYears = (expiryMs - asOfMs) / MS_PER_DAY / 365;
  if (!(timeToExpiryYears > 0)) throw new Error("OPTION_EXPIRED");

  const sqrtT = Math.sqrt(timeToExpiryYears);
  const sigmaSqrtT = volatility * sqrtT;
  const d1 = (Math.log(spotPrice / strikePrice) + (riskFreeRate - dividendYield + (volatility * volatility) / 2) * timeToExpiryYears) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;
  const discountRate = Math.exp(-riskFreeRate * timeToExpiryYears);
  const discountYield = Math.exp(-dividendYield * timeToExpiryYears);
  const pdfD1 = normalPdf(d1);

  const gamma = (discountYield * pdfD1) / (spotPrice * sigmaSqrtT);
  const vega = spotPrice * discountYield * pdfD1 * sqrtT;
  let theoreticalPrice: number;
  let delta: number;
  let theta: number;
  let rho: number;

  if (optionType === "CALL") {
    const nD1 = normalCdf(d1);
    const nD2 = normalCdf(d2);
    theoreticalPrice = spotPrice * discountYield * nD1 - strikePrice * discountRate * nD2;
    delta = discountYield * nD1;
    theta = -(spotPrice * discountYield * pdfD1 * volatility) / (2 * sqrtT) - riskFreeRate * strikePrice * discountRate * nD2 + dividendYield * spotPrice * discountYield * nD1;
    rho = strikePrice * timeToExpiryYears * discountRate * nD2;
  } else {
    const nNegD1 = normalCdf(-d1);
    const nNegD2 = normalCdf(-d2);
    theoreticalPrice = strikePrice * discountRate * nNegD2 - spotPrice * discountYield * nNegD1;
    delta = -discountYield * nNegD1;
    theta = -(spotPrice * discountYield * pdfD1 * volatility) / (2 * sqrtT) + riskFreeRate * strikePrice * discountRate * nNegD2 - dividendYield * spotPrice * discountYield * nNegD1;
    rho = -strikePrice * timeToExpiryYears * discountRate * nNegD2;
  }

  const intrinsicValue = optionType === "CALL" ? Math.max(spotPrice - strikePrice, 0) : Math.max(strikePrice - spotPrice, 0);
  const timeValue = theoreticalPrice - intrinsicValue;
  const moneyness = spotPrice === strikePrice ? "ATM" : optionType === "CALL" ? (spotPrice > strikePrice ? "ITM" : "OTM") : (spotPrice < strikePrice ? "ITM" : "OTM");
  const lifecycleStatus = asOfMs >= expiryMs ? "EXPIRED" : "ACTIVE";

  return {
    option_type: optionType,
    spot_price: fixed(spotPrice),
    strike_price: fixed(strikePrice),
    contract_multiplier: fixed(contractMultiplier),
    time_to_expiry_years: fixed(timeToExpiryYears),
    moneyness,
    theoretical_price: fixed(theoreticalPrice),
    intrinsic_value: fixed(intrinsicValue),
    time_value: fixed(timeValue),
    premium_value_per_contract: fixed(theoreticalPrice * contractMultiplier),
    delta: fixed(delta),
    gamma: fixed(gamma),
    theta: fixed(theta),
    vega: fixed(vega),
    rho: fixed(rho),
    risk_free_rate: fixed(riskFreeRate),
    dividend_yield: fixed(dividendYield),
    implied_volatility: fixed(volatility),
    lifecycle_status: lifecycleStatus,
    assumptions: {
      model: "BLACK_SCHOLES_MERTON",
      volatility_input: "ANNUALIZED_DECIMAL",
      day_count: "ACT_365",
      theta_convention: "PER_YEAR",
      vega_convention: "PER_VOL_UNIT",
      rho_convention: "PER_RATE_UNIT",
      european_exercise: true
    },
    calculation_version: "option-greeks-v1",
    source: "option_contract",
    read_only: true
  };
}
