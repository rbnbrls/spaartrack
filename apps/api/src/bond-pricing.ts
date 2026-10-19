import { generateBondCashflows, validateBondProfile, type BondProfileInput } from "./bond-profile.ts";

export type BondMetricsInput = {
  profile: BondProfileInput;
  settlementDate: string;
  yieldRate?: number | string;
  dirtyPrice?: number | string;
};

const MS_PER_DAY = 86400000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS_PER_YEAR: Record<string, number> = { ANNUAL: 1, SEMI_ANNUAL: 2, QUARTERLY: 4, MONTHLY: 12, AT_MATURITY: 1 };
const fixed = (value: number): string => value.toFixed(12);

function parseDate(value: string, error: string): Date {
  if (!DATE.test(value)) throw new Error(error);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(error);
  return date;
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to, "INVALID_BOND_PRICING_INPUT").getTime() - parseDate(from, "INVALID_BOND_PRICING_INPUT").getTime()) / MS_PER_DAY);
}

function days30_360(from: string, to: string): number {
  const start = parseDate(from, "INVALID_BOND_PRICING_INPUT");
  const end = parseDate(to, "INVALID_BOND_PRICING_INPUT");
  const d1 = Math.min(start.getUTCDate(), 30);
  const endDay = end.getUTCDate();
  const d2 = endDay === 31 && d1 === 30 ? 30 : endDay;
  return 360 * (end.getUTCFullYear() - start.getUTCFullYear()) + 30 * (end.getUTCMonth() - start.getUTCMonth()) + (d2 - d1);
}

function toOptionalNumber(value: number | string | undefined, error: string): number | undefined {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (!Number.isFinite(parsed)) throw new Error(error);
  return parsed;
}

function priceFromYield(datedAmounts: Array<{ date: string; amount: number }>, settlementDate: string, yieldRate: number, periods: number): number {
  let price = 0;
  for (const flow of datedAmounts) {
    const t = daysBetween(settlementDate, flow.date) / 365;
    price += flow.amount * Math.pow(1 + yieldRate / periods, -periods * t);
  }
  return price;
}

function solveYieldToMaturity(datedAmounts: Array<{ date: string; amount: number }>, settlementDate: string, targetPrice: number, periods: number): number {
  let lo = -0.99;
  let hi = 1;
  while (priceFromYield(datedAmounts, settlementDate, hi, periods) > targetPrice && hi < 64) hi *= 2;
  if (!(priceFromYield(datedAmounts, settlementDate, lo, periods) > targetPrice) || !(priceFromYield(datedAmounts, settlementDate, hi, periods) < targetPrice)) throw new Error("YTM_NOT_FOUND");
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const mid = (lo + hi) / 2;
    if (priceFromYield(datedAmounts, settlementDate, mid, periods) > targetPrice) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function accruedInterest(profile: ReturnType<typeof validateBondProfile>, settlementDate: string, couponDates: string[]): number {
  const face = Number(profile.face_value);
  const annualCoupon = face * Number(profile.coupon_rate);
  if (annualCoupon === 0) return 0;
  const anchors = [profile.issue_date, ...couponDates].filter((date) => date <= settlementDate).sort();
  const anchor = anchors[anchors.length - 1];
  const convention = profile.day_count_convention;
  if (profile.coupon_frequency === "AT_MATURITY") {
    const accrualDays = convention === "THIRTY_360" ? days30_360(anchor, settlementDate) : daysBetween(anchor, settlementDate);
    const termDays = convention === "THIRTY_360" ? days30_360(profile.issue_date, profile.maturity_date) : daysBetween(profile.issue_date, profile.maturity_date);
    return termDays > 0 ? annualCoupon * (accrualDays / termDays) : 0;
  }
  if (convention === "THIRTY_360") return annualCoupon * (days30_360(anchor, settlementDate) / 360);
  if (convention === "ACT_ACT") {
    const periodEnd = couponDates.find((date) => date > settlementDate) || profile.maturity_date;
    const intervalMonths = { ANNUAL: 12, SEMI_ANNUAL: 6, QUARTERLY: 3, MONTHLY: 1 }[profile.coupon_frequency] ?? 12;
    const couponPerPeriod = annualCoupon * (intervalMonths / 12);
    const periodDays = daysBetween(anchor, periodEnd);
    return periodDays > 0 ? couponPerPeriod * (daysBetween(anchor, settlementDate) / periodDays) : 0;
  }
  return annualCoupon * (daysBetween(anchor, settlementDate) / 365);
}

export function calculateBondMetrics(input: BondMetricsInput) {
  const profile = validateBondProfile(input.profile ?? ({} as BondProfileInput));
  const settlementDate = String(input.settlementDate ?? "").trim();
  parseDate(settlementDate, "INVALID_BOND_PRICING_INPUT");
  if (settlementDate < profile.issue_date || settlementDate >= profile.maturity_date) throw new Error("SETTLEMENT_OUT_OF_RANGE");

  const yieldRate = toOptionalNumber(input.yieldRate, "INVALID_BOND_YIELD");
  const dirtyPriceInput = toOptionalNumber(input.dirtyPrice, "INVALID_BOND_PRICE");
  if (dirtyPriceInput !== undefined && dirtyPriceInput <= 0) throw new Error("INVALID_BOND_PRICE");
  if ((yieldRate === undefined) === (dirtyPriceInput === undefined)) throw new Error("INVALID_BOND_PRICING_INPUT");
  if (yieldRate !== undefined && (yieldRate <= -1 || yieldRate > 100)) throw new Error("INVALID_BOND_YIELD");

  const schedule = generateBondCashflows(profile as unknown as BondProfileInput);
  const futureByDate = new Map<string, number>();
  for (const flow of schedule.cashflows) {
    if (flow.payment_date <= settlementDate) continue;
    futureByDate.set(flow.payment_date, (futureByDate.get(flow.payment_date) || 0) + Number(flow.amount));
  }
  const datedAmounts = [...futureByDate.entries()].map(([date, amount]) => ({ date, amount }));
  if (!datedAmounts.length) throw new Error("SETTLEMENT_OUT_OF_RANGE");

  const periods = PERIODS_PER_YEAR[profile.coupon_frequency];
  let resolvedYield: number;
  let yieldSource: "EXPLICIT_SCENARIO" | "SOLVED_FROM_PRICE";
  if (yieldRate !== undefined) {
    resolvedYield = yieldRate;
    yieldSource = "EXPLICIT_SCENARIO";
  } else {
    resolvedYield = solveYieldToMaturity(datedAmounts, settlementDate, dirtyPriceInput as number, periods);
    yieldSource = "SOLVED_FROM_PRICE";
  }

  let pricePv = 0;
  let macaulayNumerator = 0;
  let convexityNumerator = 0;
  for (const flow of datedAmounts) {
    const t = daysBetween(settlementDate, flow.date) / 365;
    const pv = flow.amount * Math.pow(1 + resolvedYield / periods, -periods * t);
    pricePv += pv;
    macaulayNumerator += t * pv;
    convexityNumerator += (pv * (periods * t) * (periods * t + 1)) / (periods * periods * Math.pow(1 + resolvedYield / periods, 2));
  }
  const dirtyPrice = yieldSource === "SOLVED_FROM_PRICE" ? (dirtyPriceInput as number) : pricePv;
  const macaulayDuration = macaulayNumerator / pricePv;
  const convexity = convexityNumerator / pricePv;
  const modifiedDuration = macaulayDuration / (1 + resolvedYield / periods);
  const dv01 = modifiedDuration * dirtyPrice * 0.0001;

  const couponDates = schedule.cashflows.filter((flow) => flow.cashflow_type === "COUPON").map((flow) => flow.payment_date);
  const accrued = accruedInterest(profile, settlementDate, couponDates);

  const assumptions: Record<string, string> = {
    compounding: "PERIODIC",
    discount_year_fraction: "ACT_365",
    accrual_day_count: profile.day_count_convention,
    periods_per_year: String(periods)
  };
  if (yieldSource === "SOLVED_FROM_PRICE") assumptions.solver = "bisection-v1";

  return {
    settlement_date: settlementDate,
    currency_code: profile.currency_code,
    yield_rate: fixed(resolvedYield),
    yield_source: yieldSource,
    dirty_price: fixed(dirtyPrice),
    accrued_interest: fixed(accrued),
    clean_price: fixed(dirtyPrice - accrued),
    macaulay_duration: fixed(macaulayDuration),
    modified_duration: fixed(modifiedDuration),
    convexity: fixed(convexity),
    dv01: fixed(dv01),
    periods_per_year: periods,
    cashflow_count: datedAmounts.length,
    assumptions,
    calculation_version: "bond-pricing-v1",
    source: "bond_profile",
    read_only: true
  };
}
