const resourceCapabilities = {
  portfolio: { permission: "PORTFOLIO_READ", capability: "read_portfolio" },
  activities: { permission: "ACTIVITY_READ", capability: "read_activities" },
  market_data: { permission: "MARKET_DATA_READ", capability: "read_market_data" }
} as const;

export function buildAddonSdkRead(input: { permissions?: string[]; resource?: string }) {
  const resource = String(input.resource ?? "").trim().toLowerCase() as keyof typeof resourceCapabilities;
  const contract = resourceCapabilities[resource];
  if (!contract || !(input.permissions ?? []).includes(contract.permission)) throw new Error("ADDON_SCOPE_DENIED");
  return { resource, capability: contract.capability, permission: contract.permission, calculation_version: "addon-sdk-v1", source: "addon_sdk_read", read_only: true as const, ledger_access: "none" as const };
}

export function validateAddonEventHook(input: { event_name?: string; registered_events?: string[] }) {
  const eventName = String(input.event_name ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_.-]{1,63}$/.test(eventName)) throw new Error("INVALID_ADDON_EVENT");
  if (!(input.registered_events ?? []).includes(eventName)) throw new Error("ADDON_EVENT_NOT_GRANTED");
  return { event_name: eventName, status: "ACTIVE" as const };
}
