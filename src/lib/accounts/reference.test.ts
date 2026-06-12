import { describe, expect, it } from "vitest";

import {
  isValidAccountReference,
  maskAccountReference,
  normalizeAccountReference,
} from "@/lib/accounts/reference";

describe("account references", () => {
  it("normalizes and masks an IBAN without retaining the full value", () => {
    const iban = "CH93 0076 2011 6238 5295 7";
    expect(normalizeAccountReference(iban)).toBe("CH9300762011623852957");
    expect(maskAccountReference(iban)).toBe("••••••••2957");
  });

  it("accepts an existing masked reference and rejects short identifiers", () => {
    expect(isValidAccountReference("••••••••2957")).toBe(true);
    expect(maskAccountReference("••••••••2957")).toBe("••••••••2957");
    expect(isValidAccountReference("2957")).toBe(false);
  });
});
