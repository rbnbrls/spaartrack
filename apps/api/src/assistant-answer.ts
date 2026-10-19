export type AssistantDomain = "PORTFOLIO" | "MONEY_FLOW";

export type AssistantAnswer = {
  question: string;
  domain: AssistantDomain;
  period: { start: string; end: string };
  data_as_of: string;
  read_scopes: string[];
  account_scope: string[];
  confidence: number;
  summary: string;
  mutation_tool_used: false;
  calculation_version: "assistant-answer-v1";
  source: "portfolio_snapshot + position_snapshot + money_flow_projection";
  read_only: true;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function buildAssistantAnswer(input: {
  question?: string;
  domain?: string;
  period_start?: string;
  period_end?: string;
  data_as_of?: string;
  read_scopes?: string[];
  account_scope?: string[];
  confidence?: number;
  summary?: string;
  mutation_tool_used?: boolean;
}): AssistantAnswer {
  const question = String(input.question ?? "").trim();
  if (!question || question.length > 500) throw new Error("INVALID_ASSISTANT_ANSWER");
  const domain = String(input.domain ?? "").trim().toUpperCase();
  if (domain !== "PORTFOLIO" && domain !== "MONEY_FLOW") throw new Error("INVALID_ASSISTANT_ANSWER");
  const start = String(input.period_start ?? "");
  const end = String(input.period_end ?? "");
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) throw new Error("INVALID_ASSISTANT_ANSWER");
  const asOf = String(input.data_as_of ?? "");
  if (Number.isNaN(Date.parse(asOf))) throw new Error("INVALID_ASSISTANT_ANSWER");
  const scopes = Array.isArray(input.read_scopes) ? input.read_scopes.map(String) : [];
  if (scopes.length === 0 || scopes.length > 10) throw new Error("INVALID_ASSISTANT_ANSWER");
  const accountScope = Array.isArray(input.account_scope) ? input.account_scope.map(String) : [];
  if (accountScope.length > 50) throw new Error("INVALID_ASSISTANT_ANSWER");
  const summary = String(input.summary ?? "").trim();
  if (!summary || summary.length > 2000) throw new Error("INVALID_ASSISTANT_ANSWER");
  if (input.mutation_tool_used === true) throw new Error("INVALID_ASSISTANT_ANSWER");
  const confidence = input.confidence === undefined ? 0.75 : Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("INVALID_ASSISTANT_ANSWER");
  return {
    question,
    domain: domain as AssistantDomain,
    period: { start, end },
    data_as_of: asOf,
    read_scopes: scopes,
    account_scope: accountScope,
    confidence,
    summary,
    mutation_tool_used: false,
    calculation_version: "assistant-answer-v1",
    source: "portfolio_snapshot + position_snapshot + money_flow_projection",
    read_only: true
  };
}
