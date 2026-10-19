export type BondCurveObservationInput = {
  tenorDays: number | string;
  zeroRate: number | string;
};

export type BondCurveScenarioInput = {
  curve: BondCurveObservationInput[];
  parallelShift?: number | string;
  asOfDate?: string;
  currencyCode?: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
const fixed = (value: number): string => value.toFixed(12);

function numberValue(value: number | string | undefined, error: string): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (parsed === undefined || !Number.isFinite(parsed)) throw new Error(error);
  return parsed;
}

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function buildBondCurveScenario(input: BondCurveScenarioInput) {
  const curve = Array.isArray(input?.curve) ? input.curve : [];
  if (curve.length < 2) throw new Error("INVALID_BOND_CURVE");

  const observations = curve.map((item) => ({
    tenor_days: numberValue(item?.tenorDays, "INVALID_BOND_CURVE"),
    zero_rate: numberValue(item?.zeroRate, "INVALID_BOND_CURVE")
  }));
  for (let index = 0; index < observations.length; index += 1) {
    const observation = observations[index];
    if (!Number.isInteger(observation.tenor_days) || observation.tenor_days <= 0 || observation.tenor_days > 36500) throw new Error("INVALID_BOND_CURVE");
    if (observation.zero_rate <= -1 || observation.zero_rate > 100) throw new Error("INVALID_BOND_CURVE");
    if (index > 0 && observation.tenor_days <= observations[index - 1].tenor_days) throw new Error("INVALID_BOND_CURVE");
  }

  const parallelShift = numberValue(input?.parallelShift ?? 0, "INVALID_BOND_CURVE_SHIFT");
  if (parallelShift <= -1 || parallelShift > 100) throw new Error("INVALID_BOND_CURVE_SHIFT");
  const asOfDate = String(input?.asOfDate ?? "2026-10-18").trim();
  if (!validDate(asOfDate)) throw new Error("INVALID_BOND_CURVE_DATE");
  const currencyCode = String(input?.currencyCode ?? "EUR").trim().toUpperCase();
  if (!CURRENCY.test(currencyCode)) throw new Error("INVALID_BOND_CURVE_CURRENCY");

  return {
    as_of_date: asOfDate,
    currency_code: currencyCode,
    curve_version: "synthetic-curve-v1",
    parallel_shift: fixed(parallelShift),
    observations: observations.map((observation) => ({
      tenor_days: observation.tenor_days,
      zero_rate: fixed(observation.zero_rate),
      shifted_zero_rate: fixed(observation.zero_rate + parallelShift)
    })),
    assumptions: {
      shift_type: "PARALLEL",
      rate_unit: "DECIMAL",
      interpolation: "OBSERVATIONS_ONLY"
    },
    calculation_version: "bond-curve-scenario-v1",
    source: "synthetic_curve",
    read_only: true
  };
}
