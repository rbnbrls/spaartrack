export type TaxLotTransaction = {
  id: string;
  activityType: string;
  effectiveDate: string;
  occurredAt: string;
  quantity: number;
  amount: number;
  fee: number;
  tax: number;
  currency: string;
};

export type TaxLotInput = {
  asOf: string;
  transactions: TaxLotTransaction[];
};

export type TaxLotMethod = "FIFO" | "LIFO" | "WAC" | "HIFO" | "SPECIFIC_ID";

export type TaxLotMethodInput = TaxLotInput & {
  method?: TaxLotMethod | "ALL";
  specificIds?: Record<string, Array<{ acquisition_transaction_id: string; quantity: number }>>;
};

export type RealizedGainTransaction = TaxLotTransaction & { fxRateToBase: number };

export type RealizedGainInput = {
  asOf: string;
  baseCurrency: string;
  transactions: RealizedGainTransaction[];
};

function fixed(value: number): string {
  return value.toFixed(12);
}

function validDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function holdingPeriod(acquisitionDate: string, asOf: string): "SHORT" | "LONG" {
  const days = (Date.parse(`${asOf}T00:00:00.000Z`) - Date.parse(`${acquisitionDate}T00:00:00.000Z`)) / 86_400_000;
  return days >= 365 ? "LONG" : "SHORT";
}

export function buildTaxLots(input: TaxLotInput) {
  if (!validDate(input.asOf)) throw new Error("INVALID_TAX_LOT_INPUT");
  const sorted = [...input.transactions].filter((transaction) => transaction.effectiveDate <= input.asOf).sort((a, b) => `${a.effectiveDate}|${a.occurredAt}|${a.id}`.localeCompare(`${b.effectiveDate}|${b.occurredAt}|${b.id}`));
  const lots = sorted.filter((transaction) => transaction.activityType === "BUY").map((transaction) => {
    if (!transaction.id || !validDate(transaction.effectiveDate) || transaction.effectiveDate > input.asOf || !Number.isFinite(transaction.quantity) || transaction.quantity <= 0 || !Number.isFinite(transaction.amount) || transaction.amount < 0 || !Number.isFinite(transaction.fee) || transaction.fee < 0 || !Number.isFinite(transaction.tax) || transaction.tax < 0 || !/^[A-Z]{3}$/.test(transaction.currency)) throw new Error("INVALID_TAX_LOT_INPUT");
    return {
      acquisition_transaction_id: transaction.id,
      acquisition_date: transaction.effectiveDate,
      original_quantity: transaction.quantity,
      remaining_quantity: transaction.quantity,
      cost_basis: transaction.amount + transaction.fee + transaction.tax,
      fees: transaction.fee,
      currency: transaction.currency,
      holding_period: holdingPeriod(transaction.effectiveDate, input.asOf)
    };
  });
  for (const transaction of sorted.filter((item) => item.activityType === "SELL")) {
    if (!Number.isFinite(transaction.quantity) || transaction.quantity <= 0) throw new Error("INVALID_TAX_LOT_INPUT");
    let remaining = transaction.quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, lot.remaining_quantity);
      lot.remaining_quantity -= take;
      remaining -= take;
    }
    if (remaining > 0.000000001) throw new Error("INSUFFICIENT_TAX_LOT_QUANTITY");
  }
  return {
    as_of: input.asOf,
    lots: lots.map((lot) => ({ ...lot, original_quantity: fixed(lot.original_quantity), remaining_quantity: fixed(Math.max(0, lot.remaining_quantity)), cost_basis: fixed(lot.cost_basis), fees: fixed(lot.fees) })),
    calculation_version: "tax-lots-v1",
    source: "canonical-ledger"
  };
}

function methodLots(input: TaxLotMethodInput) {
  if (!validDate(input.asOf)) throw new Error("INVALID_TAX_LOT_INPUT");
  const sorted = [...input.transactions].filter((transaction) => transaction.effectiveDate <= input.asOf).sort((a, b) => `${a.effectiveDate}|${a.occurredAt}|${a.id}`.localeCompare(`${b.effectiveDate}|${b.occurredAt}|${b.id}`));
  const lots = sorted.filter((transaction) => transaction.activityType === "BUY").map((transaction) => {
    if (!transaction.id || !validDate(transaction.effectiveDate) || !Number.isFinite(transaction.quantity) || transaction.quantity <= 0 || !Number.isFinite(transaction.amount) || transaction.amount < 0 || !Number.isFinite(transaction.fee) || transaction.fee < 0 || !Number.isFinite(transaction.tax) || transaction.tax < 0 || !/^[A-Z]{3}$/.test(transaction.currency)) throw new Error("INVALID_TAX_LOT_INPUT");
    return { id: transaction.id, remaining: transaction.quantity, unitCost: (transaction.amount + transaction.fee + transaction.tax) / transaction.quantity };
  });
  const sells = sorted.filter((transaction) => transaction.activityType === "SELL");
  const disposals: Array<{ acquisition_transaction_id: string; quantity: string; cost_basis: string }> = [];
  const consume = (sell: TaxLotTransaction, lot: { id: string; remaining: number; unitCost: number }, quantity: number) => {
    if (quantity <= 0) return;
    lot.remaining -= quantity;
    disposals.push({ acquisition_transaction_id: lot.id, quantity: fixed(quantity), cost_basis: fixed(quantity * lot.unitCost) });
  };
  for (const sell of sells) {
    if (!Number.isFinite(sell.quantity) || sell.quantity <= 0) throw new Error("INVALID_TAX_LOT_INPUT");
    let remaining = sell.quantity;
    if (input.method === "WAC") {
      const available = lots.reduce((sum, lot) => sum + lot.remaining, 0);
      if (remaining > available + 0.000000001) throw new Error("INSUFFICIENT_TAX_LOT_QUANTITY");
      const totalCost = lots.reduce((sum, lot) => sum + lot.remaining * lot.unitCost, 0);
      lots.forEach((lot) => { lot.remaining = 0; });
      disposals.push({ acquisition_transaction_id: "WAC_POOL", quantity: fixed(remaining), cost_basis: fixed(remaining * totalCost / available) });
      continue;
    }
    let candidates = lots.filter((lot) => lot.remaining > 0);
    if (input.method === "LIFO") candidates = [...candidates].reverse();
    if (input.method === "HIFO") candidates = [...candidates].sort((a, b) => b.unitCost - a.unitCost || a.id.localeCompare(b.id));
    if (input.method === "SPECIFIC_ID") {
      const selections = input.specificIds?.[sell.id];
      if (selections?.length) candidates = selections.map((selection) => lots.find((lot) => lot.id === selection.acquisition_transaction_id)).filter((lot): lot is (typeof lots)[number] => Boolean(lot));
    }
    for (const lot of candidates) {
      if (remaining <= 0) break;
      const requested = input.method === "SPECIFIC_ID" ? input.specificIds?.[sell.id]?.find((selection) => selection.acquisition_transaction_id === lot.id)?.quantity || 0 : remaining;
      const take = Math.min(remaining, lot.remaining, requested || remaining);
      consume(sell, lot, take);
      remaining -= take;
    }
    if (remaining > 0.000000001) throw new Error("INSUFFICIENT_TAX_LOT_QUANTITY");
  }
  return disposals;
}

export function compareTaxLotMethods(input: TaxLotMethodInput) {
  const requested = input.method || "ALL";
  const methods: TaxLotMethod[] = requested === "ALL" ? ["FIFO", "LIFO", "WAC", "HIFO", "SPECIFIC_ID"] : [requested];
  if (methods.some((method) => !["FIFO", "LIFO", "WAC", "HIFO", "SPECIFIC_ID"].includes(method))) throw new Error("INVALID_TAX_LOT_METHOD");
  return {
    as_of: input.asOf,
    methods: methods.map((method) => ({ method, disposals: methodLots({ ...input, method }) })),
    calculation_version: "tax-lot-methods-v1",
    source: "canonical-ledger",
    read_only: true
  };
}

export function calculateRealizedGains(input: RealizedGainInput) {
  if (!validDate(input.asOf) || !/^[A-Z]{3}$/.test(input.baseCurrency)) throw new Error("INVALID_REALIZED_GAIN_INPUT");
  const sorted = [...input.transactions]
    .filter((transaction) => transaction.effectiveDate <= input.asOf)
    .sort((a, b) => `${a.effectiveDate}|${a.occurredAt}|${a.id}`.localeCompare(`${b.effectiveDate}|${b.occurredAt}|${b.id}`));
  const lots = sorted.filter((transaction) => transaction.activityType === "BUY").map((transaction) => {
    if (!transaction.id || !validDate(transaction.effectiveDate) || transaction.effectiveDate > input.asOf || !Number.isFinite(transaction.quantity) || transaction.quantity <= 0 || !Number.isFinite(transaction.amount) || transaction.amount < 0 || !Number.isFinite(transaction.fee) || transaction.fee < 0 || !Number.isFinite(transaction.tax) || transaction.tax < 0 || !/^[A-Z]{3}$/.test(transaction.currency) || !Number.isFinite(transaction.fxRateToBase) || transaction.fxRateToBase <= 0) throw new Error("INVALID_REALIZED_GAIN_INPUT");
    return { id: transaction.id, remaining: transaction.quantity, unitCost: (transaction.amount + transaction.fee + transaction.tax) / transaction.quantity, feePerUnit: transaction.fee / transaction.quantity, taxPerUnit: transaction.tax / transaction.quantity, fxRateToBase: transaction.fxRateToBase, currency: transaction.currency };
  });
  const disposals: Array<Record<string, string>> = [];
  for (const sell of sorted.filter((transaction) => transaction.activityType === "SELL")) {
    if (!Number.isFinite(sell.quantity) || sell.quantity <= 0 || !Number.isFinite(sell.amount) || sell.amount < 0 || !Number.isFinite(sell.fee) || sell.fee < 0 || !Number.isFinite(sell.tax) || sell.tax < 0 || !/^[A-Z]{3}$/.test(sell.currency) || !Number.isFinite(sell.fxRateToBase) || sell.fxRateToBase <= 0) throw new Error("INVALID_REALIZED_GAIN_INPUT");
    let remaining = sell.quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, lot.remaining);
      if (take <= 0) continue;
      lot.remaining -= take;
      const proceeds = (sell.amount - sell.fee) * take / sell.quantity;
      const costBasis = lot.unitCost * take;
      const fees = (sell.fee * take / sell.quantity) + (lot.feePerUnit * take);
      const taxes = (sell.tax * take / sell.quantity) + (lot.taxPerUnit * take);
      const historicalCostBase = costBasis * lot.fxRateToBase;
      const disposalProceedsBase = proceeds * sell.fxRateToBase;
      const transactionCurrencyGain = proceeds - costBasis;
      const fxGain = (disposalProceedsBase - historicalCostBase) - (transactionCurrencyGain * sell.fxRateToBase);
      disposals.push({
        disposal_transaction_id: sell.id,
        acquisition_transaction_id: lot.id,
        quantity: fixed(take),
        proceeds: fixed(proceeds),
        cost_basis: fixed(costBasis),
        fees: fixed(fees),
        taxes: fixed(taxes),
        transaction_currency_gain: fixed(transactionCurrencyGain),
        historical_cost_base: fixed(historicalCostBase),
        disposal_proceeds_base: fixed(disposalProceedsBase),
        fx_gain: fixed(fxGain),
        taxable_result: fixed(transactionCurrencyGain),
        currency: sell.currency,
        acquisition_fx_rate: fixed(lot.fxRateToBase),
        disposal_fx_rate: fixed(sell.fxRateToBase)
      });
      remaining -= take;
    }
    if (remaining > 0.000000001) throw new Error("INSUFFICIENT_TAX_LOT_QUANTITY");
  }
  const sum = (key: string) => disposals.reduce((total, disposal) => total + Number(disposal[key]), 0);
  return {
    as_of: input.asOf,
    base_currency: input.baseCurrency,
    disposals,
    totals: {
      proceeds: fixed(sum("proceeds")),
      cost_basis: fixed(sum("cost_basis")),
      fees: fixed(sum("fees")),
      taxes: fixed(sum("taxes")),
      transaction_currency_gain: fixed(sum("transaction_currency_gain")),
      historical_cost_base: fixed(sum("historical_cost_base")),
      disposal_proceeds_base: fixed(sum("disposal_proceeds_base")),
      fx_gain: fixed(sum("fx_gain")),
      taxable_result: fixed(sum("taxable_result"))
    },
    calculation_version: "realized-gains-v1",
    source: "canonical-ledger",
    read_only: true
  };
}
