import { listStatementParsers, registerStatementParser } from "@/lib/statements/registry";
import { fnbCurrentAccountParser } from "@/lib/statements/parsers/fnb-current-account";
import { fnbTransactionHistoryParser } from "@/lib/statements/parsers/fnb-transaction-history";
import { genericCsvParser } from "@/lib/statements/parsers/generic-csv";
import { revolutParser } from "@/lib/statements/parsers/revolut";
import { ubsAccountParser } from "@/lib/statements/parsers/ubs-account";
import { ubsCardParser } from "@/lib/statements/parsers/ubs-card";
import type { StatementParser } from "@/lib/statements/types";

export interface ParserCatalogEntry {
  parser: StatementParser;
  label: string;
  /**
   * A parser is production-ready once at least two sanitized real fixtures
   * exercise its golden tests (AGENTS.md statement-ingestion rule 1).
   */
  productionReady: boolean;
  templateHint: string;
}

export const parserCatalog: ParserCatalogEntry[] = [
  {
    parser: ubsAccountParser,
    label: "UBS account statement (CSV)",
    productionReady: true,
    templateHint: "Semicolon-delimited export with Booking date, Value date, Currency, Debit, Credit, Balance.",
  },
  {
    parser: ubsCardParser,
    label: "UBS credit card statement (CSV)",
    productionReady: true,
    templateHint: "Semicolon-delimited export with Purchase date, Sector, Currency, Debit, Credit.",
  },
  {
    parser: revolutParser,
    label: "Revolut transactions (CSV)",
    productionReady: true,
    templateHint: "Comma-delimited export with Type, Started/Completed Date, Amount, Fee, Currency, State, Balance.",
  },
  {
    parser: genericCsvParser,
    label: "Generic CSV template",
    productionReady: true,
    templateHint: "date,amount,currency,description and optional counterparty,reference,balance,account_iban. Amount is negative for outgoing.",
  },
  {
    parser: fnbCurrentAccountParser,
    label: "FNB Private Clients Current Account statement (PDF)",
    productionReady: true,
    templateHint: "The \"Tax Invoice/Statement\" PDF from FNB online banking or emailed statements. ZAR only.",
  },
  {
    parser: fnbTransactionHistoryParser,
    label: "FNB account transaction history (CSV)",
    // Registered and fully functional, but only one real sanitized fixture
    // was available (this export only covers whatever window the user
    // pulls, observed as one month) — held back from the advertised list
    // until a second real sample confirms the format across exports, per
    // AGENTS.md statement-ingestion rule 1.
    productionReady: false,
    templateHint: "FNB online banking's transaction-history CSV download. ZAR only.",
  },
];

let registered = false;

/** Registers every catalog parser exactly once for the running process. */
export function ensureParsersRegistered(): void {
  if (registered) return;
  const existing = new Set(listStatementParsers().map((parser) => parser.key));
  for (const entry of parserCatalog) {
    if (!existing.has(entry.parser.key)) registerStatementParser(entry.parser);
  }
  registered = true;
}

export function productionReadyParsers(): Array<{
  key: string;
  institution: string;
  version: string;
  label: string;
  templateHint: string;
}> {
  return parserCatalog
    .filter((entry) => entry.productionReady)
    .map((entry) => ({
      key: entry.parser.key,
      institution: entry.parser.institution,
      version: entry.parser.version,
      label: entry.label,
      templateHint: entry.templateHint,
    }));
}
