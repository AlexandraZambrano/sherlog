// Integration test: needs Elasticsearch running (docker compose up -d).
import { describe, it, expect } from "vitest";
import { createElasticClient } from "./client";

// The edge: the only place that reads the environment.
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL ?? "http://localhost:9200";

describe("Elasticsearch", () => {
  it("is reachable and its cluster is not red", async () => {
    const client = createElasticClient(ELASTICSEARCH_URL);
    const health = await client.cluster.health().catch((error: unknown) => {
        throw new Error(`Cannot reach Elasticsearch at ${ELASTICSEARCH_URL}. Is it running? Try: docker compose up -d`, { cause: error })
    });
    expect(['green', 'yellow']).toContain(health.status)
});
});