// Pipeline test: checks that telemetry from the demo reaches Elasticsearch.
// It needs the whole stack running (docker compose up -d), so it is NOT part of CI.
import { describe, it, expect } from "vitest";
import { createElasticClient } from "./client";

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL ?? "http://localhost:9200";

/** What each kind of telemetry must look like once it has arrived. */
const expectations = [
  {
    signal: "traces",
    dataStream: "traces-generic.otel-default",
    fields: ["@timestamp", "trace_id", "span_id", "duration", "resource.attributes.service.name"],
  },
  // ...one entry for logs and one for metrics (use the field names from my probe):
  //   logs:    @timestamp, trace_id, span_id, body, resource.attributes.service.name
    {
    signal: "logs",
    dataStream: "logs-generic.otel-default",
    fields: ["@timestamp", "trace_id", "span_id", "body.text", "resource.attributes.service.name"],
  },
  //   metrics: @timestamp, resource.attributes.service.name

      {
    signal: "metrics",
    dataStream: "metrics-generic.otel-default",
    fields: ["@timestamp", "resource.attributes.service.name"],
  },
];

describe.each(expectations)("$signal pipeline", ({ signal, dataStream, fields }) => {
  const client = createElasticClient(ELASTICSEARCH_URL);

  it("has documents from the last 5 minutes", async () => {
    // ES|QL: count documents newer than 5 minutes
    const query = `FROM ${dataStream} | WHERE @timestamp > NOW() - 5 minutes | STATS n = COUNT(*)`; 
    const { records } = await client.helpers.esql({ query }).toRecords<{n: number }>();
    // records[0] can be undefined (the "empty list" lesson from the first function), so default to 0.
    const count = records[0]?.n ?? 0;
    // expect(count, "<message that says what to do>").toBeGreaterThan(0);
    expect(count, `No ${signal} arrived in the last 5 minutes. Is the demo running? Try: docker compose up -d`).toBeGreaterThan(0)

  });

  it("has the key fields", async () => {
    // client.fieldCaps(...) then check that every field in `fields` is in the answer
    const caps = await client.fieldCaps({ index: dataStream, fields });
    const found = Object.keys(caps.fields);
    expect(found).toEqual(expect.arrayContaining(fields))
  });
});