// Checks how a time written by the model is read: it must be UTC, and a Date comes out.
import { describe, it, expect } from "vitest";
import { timeWindowInput, utcTime } from "./model-input";

describe("utcTime", () => {
  it("turns a UTC time written as text into a Date", () => {
    expect(utcTime.parse("2026-10-14T20:00:00Z")).toEqual(new Date("2026-10-14T20:00:00Z"));
  });

  it("rejects text that is not a time", () => {
    expect(utcTime.safeParse("yesterday").success).toBe(false);
  });

  it("rejects a time without the Z, because it would be read in the local time zone", () => {
    expect(utcTime.safeParse("2026-10-14T20:00:00").success).toBe(false);
  });

  it("says what was wrong, so the model can fix it", () => {
    const result = utcTime.safeParse("yesterday");

    expect(result.success ? "" : result.error.issues[0]?.message).toContain("Expected a UTC time like 2026-10-14T20:00:00Z");
  });
});

describe("timeWindowInput", () => {
  it("turns from and to into a time window", () => {
    const window = timeWindowInput.parse({ from: "2026-10-14T20:00:00Z", to: "2026-10-14T20:08:00Z" });

    expect(window).toEqual({ "from": new Date("2026-10-14T20:00:00Z"), "to": new Date("2026-10-14T20:08:00Z") });
  });

  it("rejects a window that ends before it starts", () => {
    const result = timeWindowInput.safeParse({ from: "2026-10-14T20:08:00Z", to: "2026-10-14T20:00:00Z" });

    expect(result.success).toBe(false);
  });

  it("rejects a window that starts and ends at the same moment", () => {
    const result = timeWindowInput.safeParse({ from: "2026-10-14T20:00:00Z", to: "2026-10-14T20:00:00Z" });

    expect(result.success).toBe(false);
  });

  it("tells the model that from must be before to", () => {
    const result = timeWindowInput.safeParse({ from: "2026-10-14T20:08:00Z", to: "2026-10-14T20:00:00Z" });

    expect(result.success ? "" : result.error.issues[0]?.message).toContain("from must be before to");
  });

  it("names the field that has a bad time", () => {
    const result = timeWindowInput.safeParse({ from: "yesterday", to: "2026-10-14T20:00:00Z" });

    expect(result.success ? [] : result.error.issues[0]?.path).toEqual(["from"]);
  });
});
