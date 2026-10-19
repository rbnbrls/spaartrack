export type BondProfileInput = {
  issuerType: string;
  issuerName: string;
  couponRate: number | string;
  couponFrequency: string;
  issueDate: string;
  maturityDate: string;
  faceValue: number | string;
  currencyCode: string;
  dayCountConvention?: string;
};

export type BondCashflowEntry = {
  payment_date: string;
  cashflow_type: "COUPON" | "PRINCIPAL";
  amount: string;
  currency_code: string;
};

const ISSUER_TYPES = ["GOVERNMENT", "CORPORATE", "PROVINCIAL", "MUNICIPAL", "OTHER"];
const FREQUENCY_INTERVAL_MONTHS: Record<string, number> = { ANNUAL: 12, SEMI_ANNUAL: 6, QUARTERLY: 3, MONTHLY: 1, AT_MATURITY: 0 };
const DAY_COUNT_CONVENTIONS = ["ACT_365", "THIRTY_360", "ACT_ACT"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
const fixed = (value: number): string => value.toFixed(12);

function toNumber(value: number | string, error: string): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (!Number.isFinite(parsed)) throw new Error(error);
  return parsed;
}

function parseDate(value: string): Date {
  if (!DATE.test(value)) throw new Error("INVALID_BOND_PROFILE");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("INVALID_BOND_PROFILE");
  return date;
}

function addMonths(base: Date, months: number): string {
  const firstOfTargetMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const clampedDay = Math.min(base.getUTCDate(), daysInTargetMonth);
  return new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth(), clampedDay)).toISOString().slice(0, 10);
}

export function validateBondProfile(input: BondProfileInput) {
  const error = "INVALID_BOND_PROFILE";
  const raw = (input ?? {}) as Record<string, unknown>;
  const issuerType = String(raw.issuerType ?? raw.issuer_type ?? "").trim().toUpperCase();
  const issuerName = String(raw.issuerName ?? raw.issuer_name ?? "").trim();
  const couponRate = toNumber((raw.couponRate ?? raw.coupon_rate ?? NaN) as number | string, error);
  const couponFrequency = String(raw.couponFrequency ?? raw.coupon_frequency ?? "").trim().toUpperCase();
  const issueDate = String(raw.issueDate ?? raw.issue_date ?? "").trim();
  const maturityDate = String(raw.maturityDate ?? raw.maturity_date ?? "").trim();
  const faceValue = toNumber((raw.faceValue ?? raw.face_value ?? NaN) as number | string, error);
  const currencyCode = String(raw.currencyCode ?? raw.currency_code ?? "").trim().toUpperCase();
  const dayCountConvention = String(raw.dayCountConvention ?? raw.day_count_convention ?? "ACT_365").trim().toUpperCase();

  if (!ISSUER_TYPES.includes(issuerType)) throw new Error(error);
  if (!issuerName || issuerName.length > 200) throw new Error(error);
  if (!(couponRate >= 0 && couponRate <= 1)) throw new Error(error);
  if (!(couponFrequency in FREQUENCY_INTERVAL_MONTHS)) throw new Error(error);
  if (issueDate !== maturityDate && issueDate >= maturityDate) throw new Error(error);
  if (!(faceValue > 0)) throw new Error(error);
  if (!CURRENCY.test(currencyCode)) throw new Error(error);
  if (!DAY_COUNT_CONVENTIONS.includes(dayCountConvention)) throw new Error(error);
  parseDate(issueDate);
  parseDate(maturityDate);
  if (!(issueDate < maturityDate)) throw new Error(error);

  return {
    issuer_type: issuerType,
    issuer_name: issuerName,
    coupon_rate: fixed(couponRate),
    coupon_frequency: couponFrequency,
    issue_date: issueDate,
    maturity_date: maturityDate,
    face_value: fixed(faceValue),
    currency_code: currencyCode,
    day_count_convention: dayCountConvention,
    calculation_version: "bond-profile-v1"
  };
}

export function generateBondCashflows(input: BondProfileInput) {
  const profile = validateBondProfile(input);
  const currency = profile.currency_code;
  const face = Number(profile.face_value);
  const rate = Number(profile.coupon_rate);
  const maturity = parseDate(profile.maturity_date);
  const intervalMonths = FREQUENCY_INTERVAL_MONTHS[profile.coupon_frequency];
  const cashflows: BondCashflowEntry[] = [];
  const assumptions: Record<string, string | boolean> = {
    full_interval_coupons: true,
    month_end_clamping: intervalMonths < 12,
    coupon_fraction: fixed(intervalMonths / 12)
  };

  if (intervalMonths === 0) {
    cashflows.push({ payment_date: profile.maturity_date, cashflow_type: "COUPON", amount: fixed(face * rate), currency_code: currency });
    cashflows.push({ payment_date: profile.maturity_date, cashflow_type: "PRINCIPAL", amount: fixed(face), currency_code: currency });
    assumptions.full_interval_coupons = false;
    assumptions.accumulated_to_maturity = true;
  } else {
    const couponAmount = face * rate * (intervalMonths / 12);
    let cursor = parseDate(profile.issue_date);
    while (true) {
      const next = addMonths(cursor, intervalMonths);
      if (next < profile.maturity_date) {
        cashflows.push({ payment_date: next, cashflow_type: "COUPON", amount: fixed(couponAmount), currency_code: currency });
        cursor = parseDate(next);
        continue;
      }
      if (next === profile.maturity_date) {
        cashflows.push({ payment_date: next, cashflow_type: "COUPON", amount: fixed(couponAmount), currency_code: currency });
      }
      break;
    }
    cashflows.push({ payment_date: profile.maturity_date, cashflow_type: "PRINCIPAL", amount: fixed(face), currency_code: currency });
  }

  const couponTotal = cashflows.filter((flow) => flow.cashflow_type === "COUPON").reduce((sum, flow) => sum + Number(flow.amount), 0);
  const principalTotal = cashflows.filter((flow) => flow.cashflow_type === "PRINCIPAL").reduce((sum, flow) => sum + Number(flow.amount), 0);
  return {
    cashflows,
    cashflow_count: cashflows.length,
    totals: { coupon_total: fixed(couponTotal), principal_total: fixed(principalTotal), grand_total: fixed(couponTotal + principalTotal) },
    assumptions,
    calculation_version: "bond-cashflow-v1",
    source: "bond_profile",
    read_only: true
  };
}
