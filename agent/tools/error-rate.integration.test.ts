// Integration tests for error_rate against a real Elasticsearch, with its own fixture index.
import { describe, it, expect } from "vitest";
import { createElasticClient } from "../elastic/client";
import { withFixtureIndex } from "../elastic/fixture-index";
import { DATA_STREAMS } from "../elastic/schema";
import { errorRate } from "./error-rate";
import { between } from "./time-window";

const client = createElasticClient(process.env.ELASTICSEARCH_URL ?? "http://localhost:9200");
const window = between(new Date("2026-10-14T20:00:00Z"), new Date("2026-10-14T20:08:00Z"));
const baseline = between(new Date("2026-10-14T19:30:00Z"), new Date("2026-10-14T20:00:00Z"));

/** Builds a fake span. By default it is a request the service received (Server) that succeeded. */
function span(service: string, timestamp: string, options: { kind?: string; failed?: boolean } = {}) {
  return {
    "@timestamp": timestamp,
    name: "fake",
    kind: options.kind ?? "Server",
    duration: 1000,
    resource: { attributes: { "service.name": service } },
    ...(options.failed === true ? { status: { code: "Error" } } : {}),
  };
}

/** Runs the tool on the given documents, in a fixture index that is removed afterwards. */
function run(documents: readonly object[], service = "payment") {
  return withFixtureIndex(client, "traces", documents, (index) =>
    errorRate.run({ service, window, baseline }, { client, dataStreams: { ...DATA_STREAMS, traces: index } }),
  );
}

describe("errorRate", () => {
  it("compares the window with the baseline, counting only requests the service received", async () => {
    const result = await run([
      // baseline: 4 requests, none failed
      span("payment", "2026-10-14T19:40:00Z"),
      span("payment", "2026-10-14T19:41:00Z"),
      span("payment", "2026-10-14T19:42:00Z"),
      span("payment", "2026-10-14T19:43:00Z"),
      // window: 4 requests, 2 failed
      span("payment", "2026-10-14T20:01:00Z"),
      span("payment", "2026-10-14T20:02:00Z", { failed: true }),
      span("payment", "2026-10-14T20:03:00Z"),
      span("payment", "2026-10-14T20:04:00Z", { failed: true }),
      // must be ignored: a call that payment made (Client), and a failure of another service
      span("payment", "2026-10-14T20:05:00Z", { kind: "Client", failed: true }),
      span("cart", "2026-10-14T20:05:00Z", { failed: true }),
    ]);

    expect(result.data).toEqual(
        { 
        service: "payment", 
        baseline: { requests: 4, errors: 0, rate: 0 },
        current: { requests: 4, errors: 2, rate: 0.5 }, 
        change: 0.5
    });
    expect(result.query).toContain("FROM sherlog-test-traces-");
  });

  it("says there is no baseline data, and no change, when the service had no requests before", async () => {
    const result = await run([span("payment", "2026-10-14T20:01:00Z", { failed: true })]);
    expect(result.data).toEqual({
        service: "payment",
        baseline: { requests: 0, errors: 0, rate: null },
        current: { requests: 1, errors: 1, rate: 1 },
        change: null
    });
  });

  it("reports no data, not 0%, for a service that sent nothing", async () => {
    const result = await run([span("cart", "2026-10-14T20:01:00Z")], "ghost");
    expect(result.data).toEqual({
        service: "ghost",
        baseline: { requests: 0, errors: 0,  rate: null},
        current: { requests: 0, errors: 0,  rate: null},
        change: null
    });
  });
});