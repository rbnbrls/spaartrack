export type WheelLeg = "PUT_OPEN" | "PUT_ROLL" | "PUT_ASSIGNMENT" | "CALL_OPEN" | "CALL_ROLL" | "CALL_CALLED_AWAY" | "PUT_CLOSE" | "PUT_EXPIRY";

export type WheelEventInput = {
  leg?: string;
  option_type?: string;
  quantity?: number | string;
  premium?: number | string | null;
  strike?: number | string | null;
  occurred_at?: string;
};

export type WheelStage = {
  stage: "CASH_SECURED_PUT" | "PUT_ROLL" | "ASSIGNED_SHARES" | "COVERED_CALL" | "CALL_ROLL" | "CALLED_AWAY" | "PUT_CLOSED";
  leg: WheelLeg;
  option_type: string;
  quantity: string;
  premium: string | null;
  strike: string | null;
  occurred_at: string;
};

export type WheelCycle = {
  stages: WheelStage[];
  linked: boolean;
  link_reason: string;
  calculation_version: "wheel-strategy-v1";
  lifecycle_boundary: "option-lifecycle-v1";
  source: "option_contract + option_lifecycle_event";
  read_only: true;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const LEGS: WheelLeg[] = ["PUT_OPEN", "PUT_ROLL", "PUT_ASSIGNMENT", "CALL_OPEN", "CALL_ROLL", "CALL_CALLED_AWAY", "PUT_CLOSE", "PUT_EXPIRY"];

function fixed(value: number): string {
  return value.toFixed(12);
}

function toNumber(value: unknown, error: string): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) throw new Error(error);
  return parsed;
}

function parseInstant(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error("INVALID_WHEEL_EVENT");
  const date = DATE_ONLY.test(trimmed) ? new Date(`${trimmed}T00:00:00.000Z`) : new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_WHEEL_EVENT");
  return date.toISOString();
}

const STAGE_MAP: Record<WheelLeg, WheelStage["stage"]> = {
  PUT_OPEN: "CASH_SECURED_PUT",
  PUT_ROLL: "PUT_ROLL",
  PUT_ASSIGNMENT: "ASSIGNED_SHARES",
  CALL_OPEN: "COVERED_CALL",
  CALL_ROLL: "CALL_ROLL",
  CALL_CALLED_AWAY: "CALLED_AWAY",
  PUT_CLOSE: "PUT_CLOSED",
  PUT_EXPIRY: "PUT_CLOSED"
};

export function planWheelCycle(input: { events?: WheelEventInput[] }): WheelCycle {
  const events = Array.isArray(input.events) ? input.events : [];
  if (!events.length) throw new Error("INVALID_WHEEL_EVENT");
  const stages: WheelStage[] = events.map((event) => {
    const leg = String(event.leg ?? "").trim() as WheelLeg;
    if (!LEGS.includes(leg)) throw new Error("INVALID_WHEEL_EVENT");
    const optionType = String(event.option_type ?? "").trim().toUpperCase();
    if (optionType !== "PUT" && optionType !== "CALL") throw new Error("INVALID_WHEEL_EVENT");
    if (leg.startsWith("PUT") && optionType !== "PUT") throw new Error("INVALID_WHEEL_EVENT");
    if (leg.startsWith("CALL") && optionType !== "CALL") throw new Error("INVALID_WHEEL_EVENT");
    const quantity = toNumber(event.quantity, "INVALID_WHEEL_EVENT");
    if (!(quantity > 0)) throw new Error("INVALID_WHEEL_EVENT");
    let premium: string | null = null;
    if (event.premium !== undefined && event.premium !== null && String(event.premium).trim() !== "") {
      premium = fixed(toNumber(event.premium, "INVALID_WHEEL_EVENT"));
    }
    let strike: string | null = null;
    if (event.strike !== undefined && event.strike !== null && String(event.strike).trim() !== "") {
      strike = fixed(toNumber(event.strike, "INVALID_WHEEL_EVENT"));
    }
    return {
      stage: STAGE_MAP[leg],
      leg,
      option_type: optionType,
      quantity: fixed(quantity),
      premium,
      strike,
      occurred_at: parseInstant(event.occurred_at)
    };
  });
  stages.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const legs = stages.map((s) => s.leg);
  const hasPut = legs.includes("PUT_OPEN");
  const putClosedEarly = legs.includes("PUT_CLOSE") || legs.includes("PUT_EXPIRY");
  const assigned = legs.includes("PUT_ASSIGNMENT");
  const hasCall = legs.includes("CALL_OPEN") || legs.includes("CALL_ROLL") || legs.includes("CALL_CALLED_AWAY");
  let linked = true;
  let linkReason = "put, assigned shares, covered call, roll and called-away events are linked";
  if (!hasPut) {
    linked = false;
    linkReason = "wheel starts with a cash-secured put";
  } else if (hasCall && !assigned && !legs.includes("PUT_ROLL")) {
    linked = false;
    linkReason = "covered call requires assigned shares or an active put roll";
  } else if (putClosedEarly && hasCall) {
    linked = false;
    linkReason = "closed put cannot back a covered call";
  }
  return {
    stages,
    linked,
    link_reason: linkReason,
    calculation_version: "wheel-strategy-v1",
    lifecycle_boundary: "option-lifecycle-v1",
    source: "option_contract + option_lifecycle_event",
    read_only: true
  };
}
