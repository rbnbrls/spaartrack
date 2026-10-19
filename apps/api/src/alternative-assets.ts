export type AlternativeAssetValuationInput = {
  instrument_type?: string;
  asset_class?: string;
  currency_code?: string;
  valuation_source?: string;
  manual_price?: number | string | null;
  provider_price?: number | string | null;
};

export type AlternativeAssetValuation = {
  instrument_type: "CRYPTO" | "PRECIOUS_METAL" | "FUTURE" | "CUSTOM";
  asset_class: string;
  currency_code: string;
  valuation_source: "MANUAL" | "PROVIDER" | "MARKET_DATA" | "NONE";
  effective_price: string | null;
  price_origin: "manual" | "provider" | "market-data" | "none";
  calculation_version: "alternative-asset-valuation-v1";
  source: "instrument";
  read_only: true;
};

const TYPES = ["CRYPTO", "PRECIOUS_METAL", "FUTURE", "CUSTOM"];
const EXPECTED_CLASS: Record<string, string[]> = {
  CRYPTO: ["CRYPTO"],
  PRECIOUS_METAL: ["REAL_ASSET", "OTHER"],
  FUTURE: ["DERIVATIVE"],
  CUSTOM: ["REAL_ASSET", "OTHER", "EQUITY", "CASH"]
};
const SOURCES = ["MANUAL", "PROVIDER", "MARKET_DATA", "NONE"];

function fixed(value: number | string): string {
  const text = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error("INVALID_ALTERNATIVE_ASSET");
  const [whole, frac = ""] = text.split(".");
  return `${whole}.${(frac + "000000000000").slice(0, 12)}`;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) throw new Error("INVALID_ALTERNATIVE_ASSET");
  return parsed;
}

export function describeAlternativeAssetValuation(input: AlternativeAssetValuationInput): AlternativeAssetValuation {
  const type = String(input.instrument_type ?? "").trim().toUpperCase();
  if (!TYPES.includes(type)) throw new Error("INVALID_ALTERNATIVE_ASSET");
  const assetClass = String(input.asset_class ?? "").trim().toUpperCase();
  if (!EXPECTED_CLASS[type].includes(assetClass)) throw new Error("INVALID_ALTERNATIVE_ASSET");
  const currency = String(input.currency_code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("INVALID_ALTERNATIVE_ASSET");
  const source = String(input.valuation_source ?? "").trim().toUpperCase();
  if (!SOURCES.includes(source)) throw new Error("INVALID_ALTERNATIVE_ASSET");
  let effective: string | null = null;
  let origin: AlternativeAssetValuation["price_origin"] = "none";
  if (source === "MANUAL") {
    if (input.manual_price === undefined || input.manual_price === null || String(input.manual_price).trim() === "") throw new Error("INVALID_ALTERNATIVE_ASSET");
    effective = fixed(toNumber(input.manual_price));
    origin = "manual";
  } else if (source === "PROVIDER") {
    if (input.provider_price === undefined || input.provider_price === null || String(input.provider_price).trim() === "") throw new Error("INVALID_ALTERNATIVE_ASSET");
    effective = fixed(toNumber(input.provider_price));
    origin = "provider";
  } else if (source === "MARKET_DATA") {
    if (input.provider_price === undefined || input.provider_price === null || String(input.provider_price).trim() === "") throw new Error("INVALID_ALTERNATIVE_ASSET");
    effective = fixed(toNumber(input.provider_price));
    origin = "market-data";
  }
  return {
    instrument_type: type as AlternativeAssetValuation["instrument_type"],
    asset_class: assetClass,
    currency_code: currency,
    valuation_source: source as AlternativeAssetValuation["valuation_source"],
    effective_price: effective,
    price_origin: origin,
    calculation_version: "alternative-asset-valuation-v1",
    source: "instrument",
    read_only: true
  };
}
