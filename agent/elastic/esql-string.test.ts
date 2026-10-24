// Tests for esqlString: it turns any text into a safe ES|QL string literal.
import { describe, it, expect } from "vitest";
import { esqlString } from "./esql-string";

describe("esqlString", () => {
  it("wraps the text in double quotes", () => {
    expect(esqlString("payment")).toBe('"payment"');
  });

  it("escapes double quotes", () => {
    expect(esqlString('say "hi"')).toBe(String.raw`"say \"hi\""`);
  });

  it("escapes backslashes", () => {
    expect(esqlString(String.raw`C:\temp`)).toBe(String.raw`"C:\\temp"`);
  });

  it("escapes line breaks, so a name cannot span several lines", () => {
    expect(esqlString("a\nb")).toBe(String.raw`"a\nb"`);
  });

  it("neutralises an attempt to close the string and add conditions", () => {
    expect(esqlString('x" OR true OR "')).toBe(String.raw`"x\" OR true OR \""`);
  });
});