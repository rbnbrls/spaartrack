export type OptionLifecycleEventType = "OPEN" | "CLOSE" | "PARTIAL_CLOSE" | "ROLL" | "EXERCISE" | "ASSIGNMENT" | "EXPIRY";

export type OptionLifecycleOpenLot = {
  transaction_id: string;
  quantity: number | string;
  unit_cost: number | string;
  effective_date: string;
};

export type OptionLifecycleInput = {
  event_type?: string;
  quantity?: number | string;
  premium?: number | string | null;
  strike_price?: number | string | null;
  contract_multiplier?: number | string;
  option_type?: string;
  occurred_at?: string;
  effective_date?: string;
  currency_code?: string;
  fee_amount?: number | string;
  tax_amount?: number | string;
  open_lots?: OptionLifecycleOpenLot[];
  destination_option_instrument_id?: string | null;
  destination_premium?: number | string | null;
  roll_group_id?: string | null;
};

export type OptionLedgerLeg = {
  leg: "OPTION" | "DESTINATION_OPTION" | "UNDERLYING";
  activity_type: "BUY" | "SELL";
  direction: "DEBIT" | "CREDIT";
  entry_kind: "POSITION";
  quantity: string;
  unit_price: string | null;
  amount: string;
  fee_amount: string;
  tax_amount: string;
  currency_code: string;
  is_external_flow: false;
  metadata: Record<string, unknown>;
};

const EVENT_TYPES: OptionLifecycleEventType[] = ["OPEN", "CLOSE", "PARTIAL_CLOSE", "ROLL", "EXERCISE", "ASSIGNMENT", "EXPIRY"];
const OPTION_TYPES = ["CALL", "PUT"];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const EPSILON = 1e-9;

function fixed(value: number): string {
  return value.toFixed(12);
}

function toNumber(value: unknown, error: string): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) throw new Error(error);
  return parsed;
}

function optionalNumber(value: unknown, fallback: number, error: string): number {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  return toNumber(value, error);
}

function parseInstant(value: unknown, error: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error(error);
  const date = DATE_ONLY.test(trimmed) ? new Date(`${trimmed}T00:00:00.000Z`) : new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new Error(error);
  return date.toISOString();
}

function validDateOnly(value: unknown, error: string): string {
  const trimmed = String(value ?? "").trim();
  if (!DATE_ONLY.test(trimmed)) throw new Error(error);
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) throw new Error(error);
  return trimmed;
}

function validLots(raw: unknown, error: string): Array<{ transaction_id: string; quantity: number; unit_cost: number; effective_date: string }> {
  const lots = Array.isArray(raw) ? raw : [];
  return lots.map((lot) => {
    const transactionId = typeof lot?.transaction_id === "string" ? lot.transaction_id.trim() : "";
    const quantity = toNumber(lot?.quantity, error);
    const unitCost = toNumber(lot?.unit_cost, error);
    const effectiveDate = validDateOnly(lot?.effective_date, error);
    if (!transactionId || !(quantity > 0) || !(unitCost >= 0)) throw new Error(error);
    return { transaction_id: transactionId, quantity, unit_cost: unitCost, effective_date: effectiveDate };
  }).sort((a, b) => `${a.effective_date}|${a.transaction_id}`.localeCompare(`${b.effective_date}|${b.transaction_id}`));
}

function consumeLots(lots: Array<{ transaction_id: string; quantity: number; unit_cost: number }>, quantity: number, error: string) {
  const consumed: Array<{ transaction_id: string; quantity: string; cost_basis: string }> = [];
  let remaining = quantity;
  for (const lot of lots) {
    if (remaining <= EPSILON) break;
    const take = Math.min(remaining, lot.quantity);
    if (take <= EPSILON) continue;
    consumed.push({ transaction_id: lot.transaction_id, quantity: fixed(take), cost_basis: fixed(take * lot.unit_cost) });
    remaining -= take;
  }
  if (remaining > EPSILON) throw new Error(error);
  return consumed;
}

export function summarizeOptionPosition(input: { open_lots?: OptionLifecycleOpenLot[] }) {
  const error = "INVALID_OPTION_LIFECYCLE_INPUT";
  const lots = validLots(input?.open_lots, error);
  const remainingQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const remainingBasis = lots.reduce((sum, lot) => sum + lot.quantity * lot.unit_cost, 0);
  return {
    remaining_quantity: fixed(remainingQuantity),
    remaining_basis: fixed(remainingBasis),
    open_lot_count: lots.length,
    calculation_version: "option-position-v1",
    source: "canonical-ledger",
    read_only: true
  };
}

export function planOptionLifecycleEvent(input: OptionLifecycleInput) {
  const error = "INVALID_OPTION_LIFECYCLE_INPUT";
  const quantityError = "OPTION_QUANTITY_NOT_AVAILABLE";
  const raw = (input ?? {}) as Record<string, unknown>;
  const eventType = String(raw.event_type ?? "").trim().toUpperCase() as OptionLifecycleEventType;
  if (!EVENT_TYPES.includes(eventType)) throw new Error(error);

  const quantity = toNumber(raw.quantity, error);
  if (!(quantity > 0)) throw new Error(error);
  const contractMultiplier = optionalNumber(raw.contract_multiplier, 100, error);
  if (!(contractMultiplier > 0)) throw new Error(error);
  const feeAmount = optionalNumber(raw.fee_amount, 0, error);
  const taxAmount = optionalNumber(raw.tax_amount, 0, error);
  if (feeAmount < 0 || taxAmount < 0) throw new Error(error);
  const occurredAt = parseInstant(raw.occurred_at, error);
  const effectiveDate = validDateOnly(raw.effective_date, error);
  const currencyCode = String(raw.currency_code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error(error);

  const rawOptionType = String(raw.option_type ?? "").trim().toUpperCase();
  if (rawOptionType && !OPTION_TYPES.includes(rawOptionType)) throw new Error(error);
  const needsOptionType = eventType === "EXERCISE" || eventType === "ASSIGNMENT";
  if (needsOptionType && !OPTION_TYPES.includes(rawOptionType)) throw new Error(error);
  const optionType = OPTION_TYPES.includes(rawOptionType) ? rawOptionType : null;

  const premiumRequired = ["OPEN", "CLOSE", "PARTIAL_CLOSE", "ROLL"].includes(eventType);
  const premium = premiumRequired ? toNumber(raw.premium, error) : null;
  if (premiumRequired && (!(premium! > 0))) throw new Error(error);

  const strikeRequired = eventType === "EXERCISE" || eventType === "ASSIGNMENT";
  const strikePrice = strikeRequired ? toNumber(raw.strike_price, error) : null;
  if (strikeRequired && (!(strikePrice! > 0))) throw new Error(error);

  const lots = validLots(raw.open_lots, error);
  const availableQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const availableBasis = lots.reduce((sum, lot) => sum + lot.quantity * lot.unit_cost, 0);

  const consumesLots = ["CLOSE", "PARTIAL_CLOSE", "ROLL", "EXERCISE", "ASSIGNMENT", "EXPIRY"].includes(eventType);
  if (consumesLots && quantity > availableQuantity + EPSILON) throw new Error(quantityError);

  let destination: Record<string, unknown> | null = null;
  let destinationPremium: number | null = null;
  if (eventType === "ROLL") {
    const destinationId = String(raw.destination_option_instrument_id ?? "").trim();
    if (!destinationId) throw new Error("ROLL_DESTINATION_REQUIRED");
    destinationPremium = toNumber(raw.destination_premium, error);
    if (!(destinationPremium > 0)) throw new Error(error);
    destination = {
      option_instrument_id: destinationId,
      premium_per_contract: fixed(destinationPremium),
      gross_premium_amount: fixed(quantity * destinationPremium * contractMultiplier)
    };
  }

  const consumedLots = consumesLots ? consumeLots(lots, quantity, quantityError) : [];
  const consumedBasis = consumedLots.reduce((sum, lot) => sum + Number(lot.cost_basis), 0);
  const grossPremiumAmount = premium === null ? 0 : quantity * premium * contractMultiplier;
  const ledgerPlan: OptionLedgerLeg[] = [];
  let realizedPnl = 0;
  let underlyingSettlement: Record<string, unknown> | null = null;

  if (eventType === "OPEN") {
    ledgerPlan.push({
      leg: "OPTION",
      activity_type: "BUY",
      direction: "DEBIT",
      entry_kind: "POSITION",
      quantity: fixed(quantity),
      unit_price: fixed(premium!),
      amount: fixed(grossPremiumAmount),
      fee_amount: fixed(feeAmount),
      tax_amount: fixed(taxAmount),
      currency_code: currencyCode,
      is_external_flow: false,
      metadata: { lifecycle_event_type: eventType }
    });
  }

  if (eventType === "CLOSE" || eventType === "PARTIAL_CLOSE" || eventType === "ROLL") {
    realizedPnl = grossPremiumAmount - feeAmount - taxAmount - consumedBasis;
    ledgerPlan.push({
      leg: "OPTION",
      activity_type: "SELL",
      direction: "CREDIT",
      entry_kind: "POSITION",
      quantity: fixed(quantity),
      unit_price: fixed(premium!),
      amount: fixed(grossPremiumAmount),
      fee_amount: fixed(feeAmount),
      tax_amount: fixed(taxAmount),
      currency_code: currencyCode,
      is_external_flow: false,
      metadata: { lifecycle_event_type: eventType, consumed_basis: fixed(consumedBasis) }
    });
  }

  if (eventType === "ROLL") {
    ledgerPlan.push({
      leg: "DESTINATION_OPTION",
      activity_type: "BUY",
      direction: "DEBIT",
      entry_kind: "POSITION",
      quantity: fixed(quantity),
      unit_price: fixed(destinationPremium!),
      amount: fixed(quantity * destinationPremium! * contractMultiplier),
      fee_amount: "0.000000000000",
      tax_amount: "0.000000000000",
      currency_code: currencyCode,
      is_external_flow: false,
      metadata: { lifecycle_event_type: "OPEN", rolled_from: true }
    });
  }

  if (eventType === "EXERCISE" || eventType === "ASSIGNMENT") {
    const underlyingQuantity = quantity * contractMultiplier;
    const underlyingAmount = quantity * strikePrice! * contractMultiplier;
    const isCall = optionType === "CALL";
    ledgerPlan.push({
      leg: "OPTION",
      activity_type: "SELL",
      direction: "CREDIT",
      entry_kind: "POSITION",
      quantity: fixed(quantity),
      unit_price: null,
      amount: "0.000000000000",
      fee_amount: "0.000000000000",
      tax_amount: "0.000000000000",
      currency_code: currencyCode,
      is_external_flow: false,
      metadata: { lifecycle_event_type: eventType, premium_basis_transfer: fixed(consumedBasis) }
    });
    ledgerPlan.push({
      leg: "UNDERLYING",
      activity_type: isCall ? "BUY" : "SELL",
      direction: isCall ? "DEBIT" : "CREDIT",
      entry_kind: "POSITION",
      quantity: fixed(underlyingQuantity),
      unit_price: fixed(strikePrice!),
      amount: fixed(underlyingAmount),
      fee_amount: fixed(consumedBasis),
      tax_amount: "0.000000000000",
      currency_code: currencyCode,
      is_external_flow: false,
      metadata: { lifecycle_event_type: eventType, premium_basis_transfer: fixed(consumedBasis), settlement: "OPTION_PREMIUM_TO_UNDERLYING" }
    });
    underlyingSettlement = {
      event_type: eventType,
      option_type: optionType,
      activity_type: isCall ? "BUY" : "SELL",
      direction: isCall ? "DEBIT" : "CREDIT",
      quantity: fixed(underlyingQuantity),
      unit_price: fixed(strikePrice!),
      strike_price: fixed(strikePrice!),
      amount: fixed(underlyingAmount),
      premium_basis_transfer: fixed(consumedBasis)
    };
  }

  if (eventType === "EXPIRY") {
    realizedPnl = -consumedBasis - feeAmount - taxAmount;
    ledgerPlan.push({
      leg: "OPTION",
      activity_type: "SELL",
      direction: "CREDIT",
      entry_kind: "POSITION",
      quantity: fixed(quantity),
      unit_price: null,
      amount: "0.000000000000",
      fee_amount: fixed(feeAmount),
      tax_amount: fixed(taxAmount),
      currency_code: currencyCode,
      is_external_flow: false,
      metadata: { lifecycle_event_type: eventType, expired_worthless: true, realized_pnl: fixed(realizedPnl) }
    });
  }

  const effectiveEventType = eventType === "CLOSE" && quantity < availableQuantity - EPSILON ? "PARTIAL_CLOSE" : eventType;
  const remainingQuantity = consumesLots ? availableQuantity - quantity : availableQuantity + quantity;
  const remainingBasis = consumesLots
    ? availableBasis - consumedBasis + (eventType === "ROLL" ? quantity * destinationPremium! * contractMultiplier : 0)
    : availableBasis + grossPremiumAmount + feeAmount + taxAmount;

  return {
    event_type: effectiveEventType,
    requested_event_type: eventType,
    option_type: optionType,
    quantity: fixed(quantity),
    contract_multiplier: fixed(contractMultiplier),
    premium_per_contract: premium === null ? null : fixed(premium),
    gross_premium_amount: fixed(grossPremiumAmount),
    consumed_lots: consumedLots,
    consumed_basis: fixed(consumedBasis),
    fees: fixed(feeAmount),
    taxes: fixed(taxAmount),
    realized_pnl: fixed(realizedPnl),
    remaining_quantity: fixed(remainingQuantity),
    remaining_basis: fixed(remainingBasis),
    ledger_plan: ledgerPlan,
    underlying_settlement: underlyingSettlement,
    destination,
    roll_group_id: eventType === "ROLL" ? (String(raw.roll_group_id ?? "").trim() || null) : null,
    occurred_at: occurredAt,
    effective_date: effectiveDate,
    currency_code: currencyCode,
    calculation_version: "option-lifecycle-v1",
    ledger_boundary: "canonical-ledger-application-command",
    read_only: false
  };
}
