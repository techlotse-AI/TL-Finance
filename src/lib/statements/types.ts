export type StatementInstitution =
  | "UBS"
  | "REVOLUT"
  | "ZUGER_KANTONALBANK"
  | "FNB"
  | "STANDARD_BANK"
  | "INVESTEC"
  | "FRANKLY"
  | "VIAC"
  | "SAXO"
  | "UNKNOWN";

export interface StatementInput {
  filename: string;
  content: Uint8Array;
  contentType?: string;
}

export interface ParserDetection {
  confidence: number;
  reasons: string[];
}

export interface StatementWarning {
  code: string;
  message: string;
  rowNumber?: number;
}

export interface NormalizedStatementRow {
  rowNumber: number;
  bookingDate: string;
  valueDate?: string;
  amount: string;
  currency: string;
  description: string;
  counterparty?: string;
  reference?: string;
  balanceAfter?: string;
  originalRow: Record<string, unknown>;
}

export interface NormalizedStatement {
  accountIdentity?: string;
  accountMatchReference?: string;
  openingBalance?: string;
  closingBalance?: string;
  rows: NormalizedStatementRow[];
  warnings: StatementWarning[];
}

export interface StatementParser {
  key: string;
  institution: StatementInstitution;
  version: string;
  detect(input: StatementInput): ParserDetection;
  parse(input: StatementInput): Promise<NormalizedStatement>;
}
