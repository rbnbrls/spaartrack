export const AGENT_SCOPES = ["RESTRICTED_VIEW", "VIEW", "PROPOSE", "MANAGE"] as const;
export type AgentScope = typeof AGENT_SCOPES[number];
export const AGENT_SCOPE_VERSION = "agent-scopes-v1";

const CAPABILITIES: Record<AgentScope, string[]> = {
  RESTRICTED_VIEW: ["read_relative"],
  VIEW: ["read_relative", "read_amounts"],
  PROPOSE: ["read_relative", "read_amounts", "propose"],
  MANAGE: ["read_relative", "read_amounts", "propose", "manage_scopes"],
};

export function capabilitiesForScope(scope: unknown): string[] {
  if (!AGENT_SCOPES.includes(scope as AgentScope)) throw new Error("INVALID_AGENT_SCOPE");
  return [...CAPABILITIES[scope as AgentScope]];
}

export function buildAgentScopeMatrix(): { version: string; scopes: Record<AgentScope, string[]>; read_only: true } {
  return { version: AGENT_SCOPE_VERSION, scopes: { ...CAPABILITIES }, read_only: true };
}
