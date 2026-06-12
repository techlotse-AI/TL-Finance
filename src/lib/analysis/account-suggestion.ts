interface AccountSuggestionCandidate {
  id: string;
  name: string;
  maskedReference: string | null;
  pockets: Array<{ id: string; currency: string }>;
}

export interface AccountSuggestion {
  accountId: string;
  accountName: string;
  maskedReference: string | null;
  accountPocketId: string | null;
  currency: string | null;
}

export function buildAccountSuggestion(
  accounts: AccountSuggestionCandidate[],
  statementCurrencies: string[],
): AccountSuggestion | null {
  if (accounts.length !== 1) return null;

  const account = accounts[0];
  const currencies = new Set(statementCurrencies);
  const matchingPockets = account.pockets.filter((pocket) => currencies.has(pocket.currency));
  const pocket = matchingPockets.length === 1 ? matchingPockets[0] : null;

  return {
    accountId: account.id,
    accountName: account.name,
    maskedReference: account.maskedReference,
    accountPocketId: pocket?.id ?? null,
    currency: pocket?.currency ?? null,
  };
}
