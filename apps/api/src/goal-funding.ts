export type GoalFundingAllocation = {
  financial_account_id: string;
  funding_percentage: string | number;
};

export type AccountFundingContext = {
  id: string;
  portfolio_id: string;
  status: string;
  base_currency_code: string;
};

export type FundingValidation = {
  allocations: Array<{ financial_account_id: string; funding_percentage: string }>;
  total_percentage: number;
};

const UUID = /^[0-9a-f-]{36}$/i;
const PERCENTAGE = /^(0|[1-9]\d*)(\.\d{1,4})?$/;

export function validateGoalFundingAllocations(
  input: unknown,
  accounts: AccountFundingContext[],
  portfolioId: string,
  goalCurrency: string
): FundingValidation {
  if (!Array.isArray(input)) throw new Error("INVALID_GOAL_FUNDING_INPUT");
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const seen = new Set<string>();
  let total = 0;
  const allocations: Array<{ financial_account_id: string; funding_percentage: string }> = [];

  for (const candidate of input as GoalFundingAllocation[]) {
    const accountId = typeof candidate?.financial_account_id === "string" ? candidate.financial_account_id.trim() : "";
    const percentage = typeof candidate?.funding_percentage === "number" ? String(candidate.funding_percentage) : typeof candidate?.funding_percentage === "string" ? candidate.funding_percentage.trim() : "";
    if (!UUID.test(accountId) || !PERCENTAGE.test(percentage)) throw new Error("INVALID_GOAL_FUNDING_INPUT");
    if (seen.has(accountId)) throw new Error("DUPLICATE_GOAL_FUNDING_ACCOUNT");
    const account = accountMap.get(accountId);
    if (!account || account.portfolio_id !== portfolioId) throw new Error("GOAL_FUNDING_ACCOUNT_NOT_FOUND");
    if (account.status !== "ACTIVE") throw new Error("GOAL_FUNDING_ACCOUNT_UNAVAILABLE");
    if (account.base_currency_code !== goalCurrency) throw new Error("GOAL_FUNDING_CURRENCY_MISMATCH");
    seen.add(accountId);
    total += Number(percentage);
    if (total > 100.0000001) throw new Error("GOAL_FUNDING_OVERALLOCATED");
    allocations.push({ financial_account_id: accountId, funding_percentage: Number(percentage).toFixed(4) });
  }
  return { allocations, total_percentage: Number(total.toFixed(4)) };
}

export function calculateShareWeightedBalance(
  allocations: Array<{ financial_account_id: string; funding_percentage: string | number }>,
  balances: Map<string, number>
): number {
  return Number(allocations.reduce((total, allocation) => total + (balances.get(allocation.financial_account_id) || 0) * Number(allocation.funding_percentage) / 100, 0).toFixed(2));
}
