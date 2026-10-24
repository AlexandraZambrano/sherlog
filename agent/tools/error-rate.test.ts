// Tests for error_rate: the pure parts, which need no Elasticsearch.
import { describe, it, expect } from "vitest";
import { buildErrorRateQuery, makeRateSample, parseErrorRateRows } from "./error-rate";
import { between } from "./time-window";


describe("makeRateSample", () => {
  it("divides the errors by the requests", () => {
    expect(makeRateSample(100, 25)).toEqual({ requests: 100, errors: 25, rate: 0.25 });
  });

  it("says 0 when there were requests and none failed: a real zero", () => {
    expect(makeRateSample(10, 0)).toEqual({ requests: 10, errors: 0, rate: 0 });
  });

  it("says null, not 0, when there were no requests: there is no data", () => {
    expect(makeRateSample(0, 0)).toEqual({ requests: 0, errors: 0, rate: null });
  });
});

describe("buildErrorRateQuery", () => {
  const window = between(new Date("2026-10-14T20:00:00Z"), new Date("2026-10-14T20:08:00Z"));
  const baseline = between(new Date("2026-10-14T19:30:00Z"), new Date("2026-10-14T20:00:00Z"));

  it("counts requests and errors of the service in both periods, labelled current and baseline", () => {
    expect(buildErrorRateQuery({ service: "payment", window, baseline }, "traces-x")).toBe(
      [
        "FROM traces-x",
        '| WHERE kind == "Server" AND resource.attributes.service.name == "payment" AND ((@timestamp >= "2026-10-14T20:00:00.000Z" AND @timestamp < "2026-10-14T20:08:00.000Z") OR (@timestamp >= "2026-10-14T19:30:00.000Z" AND @timestamp < "2026-10-14T20:00:00.000Z"))',
        '| EVAL period = CASE(@timestamp >= "2026-10-14T20:00:00.000Z" AND @timestamp < "2026-10-14T20:08:00.000Z", "current", "baseline")',   // label each span: current if it falls in the window, baseline otherwise
        '| STATS requests = COUNT(*), errors = COUNT(*) WHERE status.code == "Error" BY period',   // count requests and errors for each label
      ].join("\n"),
    );
  });

  it("escapes the service name, so it cannot change the query", () => {
    const query = buildErrorRateQuery({ service: 'x" OR true OR "', window, baseline }, "traces-x");
    expect(query).toContain(String.raw`== "x\" OR true OR \""`);
  });

  it("rejects a baseline that overlaps the window, because the comparison would be wrong", () => {
    const overlapping = between(new Date("2026-10-14T19:30:00Z"), new Date("2026-10-14T20:03:00Z"));
    expect(() => buildErrorRateQuery({ service: "payment", window, baseline: overlapping }, "traces-x")).toThrow();
  });
});

describe("parseErrorRateRows", () => {
    it("builds both periods and the change between them", () => {
        const rows = [
            { period: "baseline", requests: 78, errors: 0 },
            { period: "current", requests: 25, errors: 11 },
        ];
        expect(parseErrorRateRows(rows, "payment")).toEqual({ 
            service: "payment", 
            current: { requests: 25, errors: 11, rate: 0.44 },
            baseline: { requests: 78, errors: 0, rate: 0 },
            change: 0.44 
        });
    });

    it("says there is no data, and no change, when the baseline has no rows", () => {
        const rows = [{ period: "current", requests: 25, errors: 11 }];
        expect(parseErrorRateRows(rows, "payment")).toEqual({
            service: "payment",
            current: { requests: 25, errors: 11, rate: 0.44 },
            baseline: { requests: 0 , errors: 0 , rate: null },
            change: null
        })
    });

    it("reports no data for both periods when there are no rows", () => {
        expect(parseErrorRateRows([], "payment")).toEqual({
            service: "payment",
            current: { requests: 0 , errors: 0 , rate: null },
            baseline: { requests: 0 , errors: 0 , rate: null },
            change: null
        })
    });
});