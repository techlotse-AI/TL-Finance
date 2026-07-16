import { UnsupportedStatementError } from "@/lib/statements/errors";
import { ensureParsersRegistered } from "@/lib/statements/parsers";
import { detectStatementParser, detectStatementParserAttempts } from "@/lib/statements/registry";
import { statementContentHash, transactionDedupeHash } from "@/lib/statements/dedupe";
import type { StatementInput } from "@/lib/statements/types";

export async function previewStatement(input: StatementInput) {
  ensureParsersRegistered();
  const parser = detectStatementParser(input);
  if (!parser) throw new UnsupportedStatementError(detectStatementParserAttempts(input));
  const statement = await parser.parse(input);
  return {
    contentHash: statementContentHash(input.content),
    parserKey: parser.key,
    parserVersion: parser.version,
    institution: parser.institution,
    accountIdentity: statement.accountIdentity,
    accountMatchReference: statement.accountMatchReference,
    openingBalance: statement.openingBalance,
    closingBalance: statement.closingBalance,
    warnings: statement.warnings,
    rows: statement.rows.map((row) => ({
      ...row,
      dedupeHash: transactionDedupeHash(parser.institution, statement.accountIdentity, row),
    })),
  };
}
