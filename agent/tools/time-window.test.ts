// Tests for TimeWindow: the dates are written with a trailing Z (UTC), so they pass on any computer.
import { describe, it, expect } from "vitest";
import { between, lastMinutes, toEsqlCondition } from "./time-window";

describe("lastMinutes", () => {
  it("starts exactly that many minutes before now", () => {
    const now = new Date("2026-10-14T20:30:00Z");
    const window = lastMinutes(30, now);
    expect(window.from).toEqual(new Date("2026-10-14T20:00:00Z"));
    expect(window.to).toEqual(now);
  });

  it("rejects zero minutes, because the window would be empty", () => {
    const now = new Date("2026-10-14T20:30:00Z");
    expect(() => lastMinutes(0, now)).toThrow();
  });
});

describe("between", () => {
  it("rejects a window whose start is not before its end", () => {
    const earlier = new Date("2026-10-14T20:00:00Z");
    const later = new Date("2026-10-14T20:08:00Z");
    expect(() => between(later, earlier)).toThrow();   // from = later, to = earlier: backwards
  });
});

describe("toEsqlCondition", () => {
  it("writes both moments in UTC, from included and to excluded", () => {
    const window = between(new Date("2026-10-14T20:00:00Z"), new Date("2026-10-14T20:08:00Z"));
    expect(toEsqlCondition(window)).toBe(
      '@timestamp >= "2026-10-14T20:00:00.000Z" AND @timestamp < "2026-10-14T20:08:00.000Z"',
    );
  });
});