const dimensions = ["fundamentals", "performance", "targets", "alerts"] as const;
const operators = ["eq", "gte", "lte", "gt", "lt"] as const;
type Dimension = typeof dimensions[number];
type Operator = typeof operators[number];

export type ScreenerFilter = { field: string; operator: Operator; value: string | number | boolean };
export type ScreenerDefinition = { name: string; filters: Record<Dimension, ScreenerFilter[]>; calculation_version: "screener-watchlist-v1"; read_only: true };

export function validateScreenerDefinition(input: unknown): void {
  if (!input || typeof input !== "object") throw new Error("INVALID_SCREENER_DEFINITION");
  const value = input as { name?: unknown; filters?: unknown };
  if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 120) throw new Error("INVALID_SCREENER_NAME");
  if (!value.filters || typeof value.filters !== "object" || Array.isArray(value.filters)) throw new Error("INVALID_SCREENER_FILTERS");
  for (const [dimension, filters] of Object.entries(value.filters as Record<string, unknown>)) {
    if (!dimensions.includes(dimension as Dimension)) throw new Error("INVALID_SCREENER_FILTER_DIMENSION");
    if (!Array.isArray(filters) || filters.length > 12) throw new Error("INVALID_SCREENER_FILTERS");
    for (const filter of filters) {
      if (!filter || typeof filter !== "object") throw new Error("INVALID_SCREENER_FILTER");
      const item = filter as Partial<ScreenerFilter>;
      if (typeof item.field !== "string" || !/^[a-z][a-z0-9_]{1,63}$/.test(item.field)) throw new Error("INVALID_SCREENER_FILTER_FIELD");
      if (!operators.includes(item.operator as Operator)) throw new Error("INVALID_SCREENER_FILTER_OPERATOR");
      if (!["string", "number", "boolean"].includes(typeof item.value) || (typeof item.value === "number" && !Number.isFinite(item.value))) throw new Error("INVALID_SCREENER_FILTER_VALUE");
    }
  }
}

export function buildScreenerDefinition(input: { name: unknown; filters: unknown; portfolioId?: unknown }): ScreenerDefinition {
  validateScreenerDefinition(input);
  const source = input.filters as Partial<Record<Dimension, ScreenerFilter[]>>;
  const filters = Object.fromEntries(dimensions.map((dimension) => [dimension, (source[dimension] || []).map((filter) => ({ field: filter.field, operator: filter.operator, value: filter.value }))])) as Record<Dimension, ScreenerFilter[]>;
  return { name: (input.name as string).trim(), filters, calculation_version: "screener-watchlist-v1", read_only: true };
}
