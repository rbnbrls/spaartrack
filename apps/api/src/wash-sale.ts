export type WashSaleLossSale = {
  id: string;
  instrumentId: string;
  instrumentName?: string;
  disposalDate: string;
  quantity: number;
  lossAmount: number;
  currency: string;
};

export type WashSalePurchase = {
  id: string;
  instrumentId: string;
  instrumentName?: string;
  purchaseDate: string;
  quantity: number;
  currency: string;
};

export type WashSaleInput = {
  windowDays: number;
  lossSales: WashSaleLossSale[];
  purchases: WashSalePurchase[];
};

const fixed = (value: number): string => value.toFixed(12);

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_WASH_SALE_INPUT");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("INVALID_WASH_SALE_INPUT");
  return date;
}

function shiftDate(date: Date, days: number): string {
  const shifted = new Date(date.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function detectWashSaleRisks(input: WashSaleInput) {
  if (!Number.isInteger(input.windowDays) || input.windowDays < 1 || input.windowDays > 365 || !Array.isArray(input.lossSales) || !Array.isArray(input.purchases)) {
    throw new Error("INVALID_WASH_SALE_INPUT");
  }
  const risks = input.lossSales.map((sale) => {
    const disposalDate = parseDate(sale.disposalDate);
    if (!sale.id || !sale.instrumentId || !Number.isFinite(sale.quantity) || sale.quantity <= 0 || !Number.isFinite(sale.lossAmount) || sale.lossAmount <= 0 || !/^[A-Z]{3}$/.test(sale.currency)) throw new Error("INVALID_WASH_SALE_INPUT");
    const windowStart = shiftDate(disposalDate, -input.windowDays);
    const windowEnd = shiftDate(disposalDate, input.windowDays);
    const relatedPurchases = input.purchases.filter((purchase) => {
      if (!purchase.id || !purchase.instrumentId || !/^\d{4}-\d{2}-\d{2}$/.test(purchase.purchaseDate) || !Number.isFinite(purchase.quantity) || purchase.quantity <= 0 || !/^[A-Z]{3}$/.test(purchase.currency)) throw new Error("INVALID_WASH_SALE_INPUT");
      return purchase.instrumentId === sale.instrumentId && purchase.purchaseDate >= windowStart && purchase.purchaseDate <= windowEnd;
    });
    const related = relatedPurchases[0];
    return {
      loss_sale_id: sale.id,
      disposal_date: sale.disposalDate,
      loss_amount: fixed(-Math.abs(sale.lossAmount)),
      currency: sale.currency,
      related_instrument_id: related?.instrumentId || sale.instrumentId,
      related_instrument_name: related?.instrumentName || sale.instrumentName || sale.instrumentId,
      related_purchase_id: related?.id || null,
      relevant_window: { start: windowStart, end: windowEnd },
      confidence: related ? "HIGH" : "LOW",
      status: related ? "AT_RISK" : "CLEAR",
      rationale: related
        ? `Related purchase ${related.id} falls inside the ${input.windowDays}-day window around the loss sale.`
        : `No related purchase was found inside the ${input.windowDays}-day window around the loss sale.`
    };
  });
  return { risks, calculation_version: "wash-sale-v1", source: "canonical-ledger", read_only: true, window_days: input.windowDays };
}
