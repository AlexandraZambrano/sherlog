// Tests for search_logs: the pure parts, which need no Elasticsearch.
import { describe, it, expect } from "vitest";
import { buildSearchLogsQuery, normalizeLimit, parseSearchLogsRows } from "./search-logs";
import { between } from "./time-window";

describe("normalizeLimit", () => {
  it("uses 10 when none is given", () => {
    expect(normalizeLimit(undefined)).toBe(10);
  });

  it("keeps a sensible limit", () => {
    expect(normalizeLimit(5)).toBe(5);
  });

  it("never returns less than 1 or more than 50, and ignores decimals and non numbers", () => {
    expect(normalizeLimit(0)).toBe(1);
    expect(normalizeLimit(500)).toBe(50);
    expect(normalizeLimit(3.7)).toBe(3);
    expect(normalizeLimit(Number.NaN)).toBe(10);
  });
});

describe("buildSearchLogsQuery", () => {
  const window = between(new Date("2026-10-14T20:00:00Z"), new Date("2026-10-14T20:08:00Z"));
  const inWindow = '@timestamp >= "2026-10-14T20:00:00.000Z" AND @timestamp < "2026-10-14T20:08:00.000Z"';

  it("groups the logs of the window by service and message, most frequent first", () => {
    expect(buildSearchLogsQuery({ window }, "logs-x")).toBe(
      [
        "FROM logs-x",
        `| WHERE ${inWindow}`,
        "| STATS count = COUNT(*), first_seen = MIN(@timestamp), last_seen = MAX(@timestamp) BY service = resource.attributes.service.name, message = body.text",
        "| SORT count DESC, service ASC, message ASC",
        "| LIMIT 11",
      ].join("\n"),
    );
  });

  it("adds the filters, in this order: service, level, text", () => {
    const query = buildSearchLogsQuery(
      { window, service: "payment", problemsOnly: true, text: "invalid token", limit: 3 },
      "logs-x",
    );
    expect(query).toContain(
      `| WHERE ${inWindow} AND resource.attributes.service.name == "payment" AND TO_UPPER(severity_text) IN ("WARN", "WARNING", "ERROR", "FATAL", "CRITICAL") AND MATCH(body.text, "invalid token")`,
    );
    expect(query).toContain("| LIMIT 4");
  });

  it("escapes the service and the text, so they cannot change the query", () => {
    const query = buildSearchLogsQuery({ window, service: 'x" OR true OR "', text: 'a"b' }, "logs-x");
    expect(query).toContain(String.raw`== "x\" OR true OR \""`);
    expect(query).toContain(String.raw`MATCH(body.text, "a\"b")`);
  });
});

describe("parseSearchLogsRows", () => {
  /** Builds a row as the query returns it. */
  const row = (service: string | null, message: string | null, count: number) => ({
    service,
    message,
    count,
    first_seen: "2026-10-14T20:01:00.000Z",
    last_seen: "2026-10-14T20:07:00.000Z",
  });

  it("turns each row into a pattern with camel case names", () => {
    expect(parseSearchLogsRows([row("payment", "Invalid token", 11)], 10)).toEqual({
        patterns: [
            {
                service: "payment",
                message: "Invalid token",
                count: 11,
                firstSeen: "2026-10-14T20:01:00.000Z",
                lastSeen: "2026-10-14T20:07:00.000Z",
            },
        ],
        truncated: false
    });
  });

  it("keeps only the limit and says so when there were more", () => {
    const result = parseSearchLogsRows([row("a", "one", 3), row("b", "two", 2), row("c", "three", 1)], 2);
    expect(result.patterns.map((pattern) => pattern.message)).toEqual([ "one", "two" ]);
    expect(result.truncated).toBe(true);
  });

  it("returns an empty list, not truncated, when no log matched", () => {
    expect(parseSearchLogsRows([], 10)).toEqual({ patterns: [], truncated: false });
  });

  it("keeps a log without message or service", () => {
    expect(parseSearchLogsRows([row(null, null, 4)], 10).patterns[0]).toMatchObject({ service: null, message: null, count: 4 });
  });
});