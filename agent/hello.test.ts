// Tests for firstServiceUpperCase.
import { describe, it, expect } from "vitest";
import { firstServiceUpperCase } from "./hello";

describe("firstServiceUpperCase", () => {
  it("returns the first service in capital letters", () => {
    expect(firstServiceUpperCase(["cart", "payment"])).toBe("CART");
  });

  it("rreturns the fallback when the list is empty", () => {
    expect(firstServiceUpperCase([])).toBe("UNKNOWN");
  });

  it("returns the fallback when the first name is empty", () => {
    expect(firstServiceUpperCase([""])).toBe("UNKNOWN");
  })
});