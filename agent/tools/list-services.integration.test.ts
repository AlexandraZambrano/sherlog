// Integration tests for list_services against a real Elasticsearch, with its own fixture index.
import { describe, it, expect } from "vitest";
import { createElasticClient } from "../elastic/client";
import { withFixtureIndex } from "../elastic/fixture-index";
import { DATA_STREAMS } from "../elastic/schema";
import { listServices } from "./list-services";
import { between } from "./time-window";

const client = createElasticClient(process.env.ELASTICSEARCH_URL ?? "http://localhost:9200");

/** Builds a fake span with only what these tests need. */
function span(service: string, timestamp: string) {
  return {
    "@timestamp": timestamp,
    name: "fake",
    kind: "Server",
    duration: 1000,
    resource: { attributes: { "service.name": service } },
  };
}

describe("listServices", () => {
  it("lists the services that reported spans in the window, busiest first", async () => {
    const window = between(new Date("2026-10-14T20:00:00Z"), new Date("2026-10-14T20:08:00Z"));
    const documents = [
      span("payment", "2026-10-14T20:01:00Z"),
      span("cart", "2026-10-14T20:02:00Z"),
      span("cart", "2026-10-14T20:03:00Z"),
      span("email", "2026-10-14T20:09:00Z"),   // outside the window
    ];

    const result = await withFixtureIndex(client, "traces", documents, (index) =>
      listServices.run({ window }, { client, dataStreams: { ...DATA_STREAMS, traces: index } }),
    );

    expect(result.data).toEqual({ services: [{ name: "cart", spans: 2 }, { name: "payment", spans: 1 }] });
    expect(result.query).toContain("FROM sherlog-test-traces-");   // the card carries the query that produced it
  });

  it("returns an empty list when nothing reported in the window", async () => {
    const window = between(new Date("2026-10-14T20:00:00Z"), new Date("2026-10-14T20:08:00Z"));
    const documents = [span("email", "2026-10-14T21:00:00Z")];   // an hour after the window

    const result = await withFixtureIndex(client, "traces", documents, (index) =>
      listServices.run({ window }, { client, dataStreams: { ...DATA_STREAMS, traces: index } }),
    );

    expect(result.data).toEqual({ services: [] });
  });
});