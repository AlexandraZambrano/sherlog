// A test helper: gives a test its own index with known documents, and removes it afterwards.
import { randomUUID } from "node:crypto";
import type { Client, estypes } from "@elastic/elasticsearch";

/** Which kind of telemetry the fixture imitates. */
export type FixtureKind = "traces" | "logs";

const RESOURCE_MAPPING: estypes.MappingProperty = {
  properties: { attributes: { properties: { "service.name": { type: "keyword" } } } },
};

const MAPPINGS: Record<FixtureKind, estypes.MappingTypeMapping> = {
  traces: {
    properties: {
      "@timestamp": { type: "date" },
      trace_id: { type: "keyword" },
      span_id: { type: "keyword" },
      parent_span_id: { type: "keyword" },
      name: { type: "keyword" },
      kind: { type: "keyword" },
      duration: { type: "long" },
      status: { properties: { code: { type: "keyword" } } },
      resource: RESOURCE_MAPPING,
    },
  },
  logs: {
    properties: {
      "@timestamp": { type: "date" },
      trace_id: { type: "keyword" },
      span_id: { type: "keyword" },
      body: { properties: { text: { type: "match_only_text" } } },
      severity_text: { type: "keyword" },
      resource: RESOURCE_MAPPING,
    },
  },
};

export async function withFixtureIndex<T>(
  client: Client,
  kind: FixtureKind,
  documents: readonly object[],
  use: (index: string) => Promise<T>,
): Promise<T> {
  const index = `sherlog-test-${kind}-${randomUUID()}`;
  await client.indices.create({ index, mappings: MAPPINGS[kind] });
  try {
    if (documents.length > 0) {
      await client.bulk({
        refresh: true,
        operations: documents.flatMap((document) => [{ index: { _index: index } }, document]),
      });
    }
    return await use(index);
  } finally {
    await client.indices.delete({ index, ignore_unavailable: true });
  }
}