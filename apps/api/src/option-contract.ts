export type OptionContractInput = {
  optionType?: string;
  option_type?: string;
  strikePrice?: number | string;
  strike_price?: number | string;
  expiryAt?: string;
  expiry_at?: string;
  contractMultiplier?: number | string;
  contract_multiplier?: number | string;
  impliedVolatility?: number | string;
  implied_volatility?: number | string;
  asOf?: string;
  as_of?: string;
  lifecycleEvents?: OptionLifecycleEventInput[];
  lifecycle_events?: OptionLifecycleEventInput[];
};

export type OptionLifecycleEventInput = {
  event_type?: string;
  eventType?: string;
  occurred_at?: string;
  occurredAt?: string;
};

export type OptionLifecycleStatus = "ACTIVE" | "EXPIRED" | "CLOSED" | "EXERCISED" | "ASSIGNED" | "ROLLED";

const OPTION_TYPES = ["CALL", "PUT"];
const TERMINAL_EVENT_STATUS: Record<string, OptionLifecycleStatus> = {
  CLOSE: "CLOSED",
  EXERCISE: "EXERCISED",
  ASSIGNMENT: "ASSIGNED",
  EXPIRY: "EXPIRED",
  ROLL: "ROLLED"
};
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const fixed = (value: number): string => value.toFixed(12);

function toNumber(value: unknown, error: string): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) throw new Error(error);
  return parsed;
}

function parseInstant(value: string, error: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(error);
  const date = DATE_ONLY.test(trimmed) ? new Date(`${trimmed}T00:00:00.000Z`) : new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new Error(error);
  return date.toISOString();
}

function optionalInstant(value: unknown, error: string): string | undefined {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  return parseInstant(String(value), error);
}

export function deriveOptionLifecycleStatus(input: { expiryAt: string; asOf?: string; lifecycleEvents?: OptionLifecycleEventInput[] }) {
  const expiryAt = parseInstant(String(input.expiryAt ?? ""), "INVALID_OPTION_CONTRACT");
  const asOf = input.asOf === undefined ? new Date().toISOString() : parseInstant(String(input.asOf), "INVALID_OPTION_CONTRACT");
  let terminal: { status: OptionLifecycleStatus; event_type: string; occurred_at: string } | null = null;
  for (const event of input.lifecycleEvents ?? []) {
    const eventType = String(event.event_type ?? event.eventType ?? "").trim().toUpperCase();
    const status = TERMINAL_EVENT_STATUS[eventType];
    if (!status) continue;
    const occurredAt = parseInstant(String(event.occurred_at ?? event.occurredAt ?? ""), "INVALID_OPTION_CONTRACT");
    if (!terminal || occurredAt > terminal.occurred_at) terminal = { status, event_type: eventType, occurred_at: occurredAt };
  }
  if (terminal) {
    return { status: terminal.status, source: "LIFECYCLE_EVENT", as_of: asOf, expiry_at: expiryAt, terminal_event_type: terminal.event_type };
  }
  return {
    status: (asOf >= expiryAt ? "EXPIRED" : "ACTIVE") as OptionLifecycleStatus,
    source: "EXPIRY_SCHEDULE",
    as_of: asOf,
    expiry_at: expiryAt,
    terminal_event_type: null
  };
}

export function validateOptionContract(input: OptionContractInput) {
  const error = "INVALID_OPTION_CONTRACT";
  const raw = (input ?? {}) as Record<string, unknown>;
  const optionType = String(raw.optionType ?? raw.option_type ?? "").trim().toUpperCase();
  const strikePrice = toNumber(raw.strikePrice ?? raw.strike_price ?? NaN, error);
  const contractMultiplier = toNumber(raw.contractMultiplier ?? raw.contract_multiplier ?? 100, error);
  const ivRaw = raw.impliedVolatility ?? raw.implied_volatility;
  const impliedVolatility = ivRaw === undefined || ivRaw === null || String(ivRaw).trim() === "" ? null : toNumber(ivRaw, error);
  const asOf = optionalInstant(raw.asOf ?? raw.as_of, error);
  const events = (raw.lifecycleEvents ?? raw.lifecycle_events) as OptionLifecycleEventInput[] | undefined;

  if (!OPTION_TYPES.includes(optionType)) throw new Error(error);
  if (!(strikePrice > 0)) throw new Error(error);
  if (!(contractMultiplier > 0)) throw new Error(error);
  if (impliedVolatility !== null && !(impliedVolatility > 0 && impliedVolatility <= 5)) throw new Error(error);
  const expiryAt = parseInstant(String(raw.expiryAt ?? raw.expiry_at ?? ""), error);
  const lifecycle = deriveOptionLifecycleStatus({ expiryAt, asOf, lifecycleEvents: Array.isArray(events) ? events : undefined });

  return {
    option_type: optionType,
    strike_price: fixed(strikePrice),
    expiry_at: expiryAt,
    contract_multiplier: fixed(contractMultiplier),
    implied_volatility: impliedVolatility === null ? null : fixed(impliedVolatility),
    lifecycle_status: lifecycle.status,
    lifecycle_source: lifecycle.source,
    as_of: lifecycle.as_of,
    calculation_version: "option-contract-v1",
    read_only: true
  };
}
