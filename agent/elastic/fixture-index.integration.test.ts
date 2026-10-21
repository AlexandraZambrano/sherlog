// Tests for withFixtureIndex: a helper that gives a test its own index with known documents.
import { describe, it, expect } from "vitest";
import { createElasticClient } from "./client";
import { runEsql } from "./run-esql";
import { withFixtureIndex } from "./fixture-index";
import { FIELDS, SPAN_STATUS } from "./schema";
import { between, toEsqlCondition } from "../tools/time-window";

const client = createElasticClient(process.env.ELASTICSEARCH_URL ?? "http://localhost:9200");

/** Builds a fake span with only what these tests need. */
function span(service: string, statusCode?: string, timestamp = "2026-10-14T20:00:00Z") {
  return {
    "@timestamp": timestamp,
    name: "fake",
    kind: "Server",
    duration: 1000,
    resource: { attributes: { "service.name": service } },
    ...(statusCode === undefined ? {} : { status: { code: statusCode } }),
  };
}

describe("withFixtureIndex", () => {
  it("makes the documents queryable, grouped by service", async () => {
    const documents = [span("payment", SPAN_STATUS.error), span("payment"), span("cart")];
    const rows = await withFixtureIndex(client, "traces", documents, (index) =>
      runEsql<{ n: number; errors: number; service: string }>(
        client,
        `FROM ${index} | STATS n = COUNT(*), errors = COUNT(*) WHERE ${FIELDS.statusCode} == "${SPAN_STATUS.error}" BY service = ${FIELDS.serviceName} | SORT service`,
      ),
    );
    // cart has 1 span and no errors. payment has 2 spans and 1 error.
    expect(rows).toEqual([
        { n: 1, errors:0, service: "cart" },
        { n: 2, errors: 1, service: "payment" }
    ]);
  });

  it("deletes the index afterwards, even when the callback throws", async () => {
    let name = "";
    const failing = withFixtureIndex(client, "logs", [], (index) => {
      name = index;
      return Promise.reject(new Error("boom"));
    });
    await expect(failing).rejects.toThrow("boom");
    expect(await client.indices.exists({ index: name })).toBe(false);
  });

  it("works with TimeWindow: only documents inside the window are counted", async () => {
    const window = between(new Date("2026-10-14T20:00:00Z"), new Date("2026-10-14T20:08:00Z"));
    // One span at 20:03 (inside) and one at exactly 20:08 (outside: `to` is excluded).
    const documents = [span("a", undefined, "2026-10-14T20:03:00Z"), span("a", undefined, "2026-10-14T20:08:00Z")];
    const rows = await withFixtureIndex(client, "traces", documents, (index) =>
      runEsql<{ n: number }>(client, `FROM ${index} | WHERE ${toEsqlCondition(window)} | STATS n = COUNT(*)`),
    );
    expect(rows).toEqual([{ n:1 }]);
  });
});