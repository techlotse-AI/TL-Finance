import { describe, expect, it } from "vitest";

import { looksLikeOfx, parseOfx } from "@/lib/statements/ofx";

/**
 * These fixtures are hand-crafted from the public OFX spec's documented
 * transaction shape — NOT sanitized real bank exports (unlike the CSV
 * fixtures under fixtures/, which are real, sanitized samples). No specific
 * institution's OFX dialect has been validated against this reader yet.
 */
const SGML_SAMPLE = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260504120000
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>ZAR
<BANKACCTFROM>
<ACCTID>1234567890
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260501000000
<DTEND>20260531000000
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260504120000
<TRNAMT>-450.00
<FITID>202605041001
<NAME>Woolworths
<MEMO>Groceries
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260505083000
<TRNAMT>25000.00
<FITID>202605051002
<NAME>Salary
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>24550.00
<DTASOF>20260531000000
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="200" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>CHF</CURDEF>
        <BANKACCTFROM>
          <ACCTID>CH9300762011623852957</ACCTID>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260506000000</DTPOSTED>
            <TRNAMT>-89.50</TRNAMT>
            <FITID>1</FITID>
            <NAME>Migros</NAME>
            <CURRENCY>CHF</CURRENCY>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

describe("looksLikeOfx", () => {
  it("recognizes OFX 1.x SGML and OFX 2.x XML", () => {
    expect(looksLikeOfx(SGML_SAMPLE)).toBe(true);
    expect(looksLikeOfx(XML_SAMPLE)).toBe(true);
  });

  it("rejects plain text and CSV content", () => {
    expect(looksLikeOfx("Date,Amount,Description\n2026-05-01,-10.00,Coffee\n")).toBe(false);
    expect(looksLikeOfx("this is not a statement at all\njust prose\n")).toBe(false);
  });
});

describe("parseOfx — OFX 1.x SGML dialect", () => {
  it("reads unclosed leaf tags, stopping each value at the next tag", () => {
    const statement = parseOfx(SGML_SAMPLE);
    expect(statement.defaultCurrency).toBe("ZAR");
    expect(statement.accountId).toBe("1234567890");
    expect(statement.transactions).toHaveLength(2);

    const [debit, credit] = statement.transactions;
    expect(debit).toMatchObject({
      type: "DEBIT",
      datePosted: "2026-05-04",
      amount: "-450.00",
      fitId: "202605041001",
      name: "Woolworths",
      memo: "Groceries",
    });
    expect(credit).toMatchObject({
      type: "CREDIT",
      datePosted: "2026-05-05",
      amount: "25000.00",
      fitId: "202605051002",
      name: "Salary",
    });
  });
});

describe("parseOfx — OFX 2.x XML dialect", () => {
  it("reads properly closed tags the same way as the SGML dialect", () => {
    const statement = parseOfx(XML_SAMPLE);
    expect(statement.defaultCurrency).toBe("CHF");
    expect(statement.accountId).toBe("CH9300762011623852957");
    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0]).toMatchObject({
      type: "DEBIT",
      datePosted: "2026-05-06",
      amount: "-89.50",
      fitId: "1",
      name: "Migros",
      currency: "CHF",
    });
  });
});

describe("parseOfx — malformed or non-OFX content", () => {
  it("returns an empty transaction list rather than throwing", () => {
    expect(parseOfx("not ofx at all").transactions).toEqual([]);
    expect(parseOfx("").transactions).toEqual([]);
  });
});
