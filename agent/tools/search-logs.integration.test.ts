// Integration tests for search_logs against a real Elasticsearch, with its own fixture index.
import { describe, it, expect } from "vitest";
import { createElasticClient } from "../elastic/client";
import { withFixtureIndex } from "../elastic/fixture-index";
import { DATA_STREAMS } from "../elastic/schema";
import { searchLogs, type SearchLogsInput } from "./search-logs";
import { between } from "./time-window";

const client = createElasticClient(process.env.ELASTICSEARCH_URL ?? "http://localhost:9200");
const window = between(new Date("2026-10-14T20:00:00Z"), new Date("2026-10-14T20:08:00Z"));

/** Builds a fake log line. The level is optional, because most real logs have none. */
function log(service: string, timestamp: string, message: string, severity?: string) {
  return {
    "@timestamp": timestamp,
    resource: { attributes: { "service.name": service } },
    body: { text: message },
    ...(severity === undefined ? {} : { severity_text: severity }),
  };
}

/** Runs the tool on the given logs, in a fixture index that is removed afterwards. */
function run(documents: readonly object[], input: Omit<SearchLogsInput, "window"> = {}) {
  return withFixtureIndex(client, "logs", documents, (index) =>
    searchLogs.run({ window, ...input }, { client, dataStreams: { ...DATA_STREAMS, logs: index } }),
  );
}

describe("searchLogs", () => {
  it("groups the logs by service and message, most frequent first, with when they first and last appeared", async () => {
    const result = await run([
      log("payment", "2026-10-14T20:01:00Z", "Charge request received."),
      log("payment", "2026-10-14T20:03:00Z", "Charge request received."),
      log("payment", "2026-10-14T20:05:00Z", "Charge request received."),
      log("payment", "2026-10-14T20:02:00Z", "Payment failed. Invalid token."),
      log("payment", "2026-10-14T20:06:00Z", "Payment failed. Invalid token."),
      log("cart", "2026-10-14T20:04:00Z", "Cart emptied"),
      log("cart", "2026-10-14T20:09:00Z", "Cart emptied"),   // outside the window
    ]);

    expect(result.data).toEqual({
        patterns:[
            {
                service: "payment",
                message: "Charge request received.",
                count: 3,
                firstSeen: "2026-10-14T20:01:00.000Z",
                lastSeen: "2026-10-14T20:05:00.000Z"
            },
            {
                service: "payment",
                message: "Payment failed. Invalid token.",
                count: 2,
                firstSeen: "2026-10-14T20:02:00.000Z",
                lastSeen: "2026-10-14T20:06:00.000Z"
            },
            {
                service: "cart",
                message: "Cart emptied",
                count: 1,
                firstSeen: "2026-10-14T20:04:00.000Z",
                lastSeen: "2026-10-14T20:04:00.000Z"
            },
        ],
        truncated: false
    });
    expect(result.query).toContain("FROM sherlog-test-logs-");
  });

  it("with problemsOnly keeps warnings and errors, however the level is written", async () => {
    const result = await run(
      [
        log("payment", "2026-10-14T20:01:00Z", "Payment failed.", "warn"),
        log("payment", "2026-10-14T20:02:00Z", "Payment failed.", "warn"),
        log("cart", "2026-10-14T20:03:00Z", "Cart broke", "ERROR"),
        log("cart", "2026-10-14T20:04:00Z", "Cart read", "Information"),
        log("cart", "2026-10-14T20:05:00Z", "Cart written"),   // no level at all
      ],
      { problemsOnly: true },
    );

    expect(result.data.patterns.map((pattern) => pattern.message)).toEqual([ "Payment failed.", "Cart broke" ]);
  });

  it("filters by service and by text", async () => {
    const result = await run(
      [
        log("payment", "2026-10-14T20:01:00Z", "Payment failed. Invalid token."),
        log("payment", "2026-10-14T20:02:00Z", "Charge request received."),
        log("cart", "2026-10-14T20:03:00Z", "Invalid token in the cart"),
      ],
      { service: "payment", text: "invalid token" },
    );

    expect(result.data.patterns.map((pattern) => pattern.message)).toEqual([ "Payment failed. Invalid token." ]);
  });

  it("keeps only the limit and says there was more", async () => {
    const result = await run(
      [log("a", "2026-10-14T20:01:00Z", "one"), log("a", "2026-10-14T20:02:00Z", "two"), log("a", "2026-10-14T20:03:00Z", "three")],
      { limit: 2 },
    );

    expect(result.data.patterns).toHaveLength(2);
    expect(result.data.truncated).toBe(true);
  });
});