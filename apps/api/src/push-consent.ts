export type PushChannel = "PUSH" | "IN_APP" | "EMAIL";

export type PushConsent = {
  channel: PushChannel;
  status: "GRANTED" | "REVOKED";
  device_label: string;
  calculation_version: "push-consent-v1";
  source: "push_consent";
  read_only: true;
};

const CHANNELS: PushChannel[] = ["PUSH", "IN_APP", "EMAIL"];

export function validatePushConsent(input: {
  channel?: string;
  enabled?: boolean;
  device_label?: string;
}): PushConsent {
  const channel = String(input.channel ?? "").trim().toUpperCase();
  if (!CHANNELS.includes(channel as PushChannel)) throw new Error("INVALID_PUSH_CONSENT");
  const label = String(input.device_label ?? "").trim();
  if (!label || label.length > 120) throw new Error("INVALID_PUSH_CONSENT");
  if (typeof input.enabled !== "boolean") throw new Error("INVALID_PUSH_CONSENT");
  return {
    channel: channel as PushChannel,
    status: input.enabled ? "GRANTED" : "REVOKED",
    device_label: label,
    calculation_version: "push-consent-v1",
    source: "push_consent",
    read_only: true
  };
}

export type PushDelivery = {
  event: string;
  channel: PushChannel;
  delivery_status: "DELIVERED" | "FAILED";
  failure_reason: string | null;
  calculation_version: "push-delivery-v1";
  source: "notification";
  read_only: true;
};

export function recordPushDelivery(input: {
  event?: string;
  channel?: string;
  status?: string;
  failure_reason?: string;
}): PushDelivery {
  const event = String(input.event ?? "").trim();
  if (!event || event.length > 80) throw new Error("INVALID_PUSH_DELIVERY");
  const channel = String(input.channel ?? "").trim().toUpperCase();
  if (!CHANNELS.includes(channel as PushChannel)) throw new Error("INVALID_PUSH_DELIVERY");
  const status = String(input.status ?? "").trim().toUpperCase();
  if (status !== "DELIVERED" && status !== "FAILED") throw new Error("INVALID_PUSH_DELIVERY");
  const failure = input.failure_reason === undefined || input.failure_reason === null ? null : String(input.failure_reason).trim();
  if (status === "FAILED" && !failure) throw new Error("INVALID_PUSH_DELIVERY");
  if (failure !== null && failure.length > 200) throw new Error("INVALID_PUSH_DELIVERY");
  return {
    event,
    channel: channel as PushChannel,
    delivery_status: status as "DELIVERED" | "FAILED",
    failure_reason: failure,
    calculation_version: "push-delivery-v1",
    source: "notification",
    read_only: true
  };
}
