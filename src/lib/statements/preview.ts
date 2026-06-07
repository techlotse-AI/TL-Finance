import { detectStatementParser } from "@/lib/statements/registry";
import { statementContentHash, transactionDedupeHash } from "@/lib/statements/dedupe";
import type { StatementInput } from "@/lib/statements/types";

export async function previewStatement(input: StatementInput) {
  const parser = detectStatementParser(input);
  if (!parser) throw new Error("No statement parser could be selected with unambiguous confidence.");
  const statement = await parser.parse(input);
  return {
    contentHash: statementContentHash(input.content),
    parserKey: parser.key,
    parserVersion: parser.version,
    institution: parser.institution,
    accountIdentity: statement.accountIdentity,
    openingBalance: statement.openingBalance,
    closingBalance: statement.closingBalance,
    warnings: statement.warnings,
    rows: statement.rows.map((row) => ({
      ...row,
      dedupeHash: transactionDedupeHash(parser.institution, statement.accountIdentity, row),
    })),
  };
}
