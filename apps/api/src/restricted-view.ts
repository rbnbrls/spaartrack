export type RestrictedViewPosition = {
  instrument_id: string;
  name: string;
  allocation_pct: string;
  relative_weight: string;
  currency_code: string;
};

export type RestrictedView = {
  positions: RestrictedViewPosition[];
  allocation_total_pct: string;
  currency_code: string;
  calculation_version: "restricted-view-v1";
  source: "position_snapshot + portfolio_snapshot";
  read_only: true;
};

export function projectRestrictedView(input: {
  positions?: Array<{ instrument_id?: string; name?: string; market_value?: number | string; currency_code?: string }>;
  portfolio_value?: number | string;
  currency_code?: string;
}): RestrictedView {
  const positions = Array.isArray(input.positions) ? input.positions : [];
  if (!positions.length) throw new Error("INVALID_RESTRICTED_VIEW");
  const currency = String(input.currency_code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("INVALID_RESTRICTED_VIEW");
  let total = typeof input.portfolio_value === "string" ? Number(input.portfolio_value.trim()) : input.portfolio_value;
  if (typeof total !== "number" || !Number.isFinite(total)) throw new Error("INVALID_RESTRICTED_VIEW");
  const values = positions.map((row) => {
    const value = typeof row.market_value === "string" ? Number(row.market_value.trim()) : row.market_value;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("INVALID_RESTRICTED_VIEW");
    const rowCurrency = String(row.currency_code ?? currency).trim().toUpperCase();
    if (rowCurrency !== currency) throw new Error("INVALID_RESTRICTED_VIEW");
    return { instrument_id: String(row.instrument_id ?? "").trim(), name: String(row.name ?? "").trim(), value };
  });
  for (const row of values) {
    if (!row.instrument_id || !row.name) throw new Error("INVALID_RESTRICTED_VIEW");
  }
  const sum = values.reduce((acc, row) => acc + row.value, 0);
  if (sum <= 0) throw new Error("INVALID_RESTRICTED_VIEW");
  if (!(total > 0)) total = sum;
  if (Math.abs(sum - total) / total > 1e-9) throw new Error("INVALID_RESTRICTED_VIEW");
  const raw = values.map((row) => (row.value / total) * 100);
  const floors = raw.map((pct) => Math.floor(pct * 100) / 100);
  let remainder = Math.round((100 - floors.reduce((a, b) => a + b, 0)) * 100);
  const order = raw.map((pct, i) => ({ i, frac: pct * 100 - Math.floor(pct * 100) })).sort((a, b) => b.frac - a.frac);
  const hundredths = floors.map((f) => Math.round(f * 100));
  for (const { i } of order) {
    if (remainder <= 0) break;
    hundredths[i] += 1;
    remainder -= 1;
  }
  return {
    positions: values.map((row, i) => ({
      instrument_id: row.instrument_id,
      name: row.name,
      allocation_pct: (hundredths[i] / 100).toFixed(12),
      relative_weight: `${(hundredths[i] / 100).toFixed(2)}%`,
      currency_code: currency
    })),
    allocation_total_pct: "100.000000000000",
    currency_code: currency,
    calculation_version: "restricted-view-v1",
    source: "position_snapshot + portfolio_snapshot",
    read_only: true
  };
}
