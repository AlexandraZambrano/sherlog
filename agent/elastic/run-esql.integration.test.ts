// Integration tests for runEsql. ROW makes up data, so they need no demo data and run in CI.
import { describe, it, expect } from "vitest";
import { Client } from "@elastic/elasticsearch";
import { createElasticClient } from "./client";
import { runEsql } from "./run-esql";

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL ?? "http://localhost:9200";

describe("runEsql", () => {
  const client = createElasticClient(ELASTICSEARCH_URL);

  it("returns one object per row", async () => {
    const rows = await runEsql<{ n: number; doubled: number }>(client, "ROW n = 21 | EVAL doubled = n * 2");
    expect(rows).toEqual([{ n: 21, doubled: 42 }]);
  });

  it("returns an empty list when nothing matches", async () => {
    expect(await runEsql(client, "ROW n = 1 | WHERE n > 5")).toEqual([]);
  });

  it("says what Elasticsearch rejected, and shows the query", async () => {
    const query = "FROM does-not-exist | LIMIT 1";
    await expect(runEsql(client, query)).rejects.toThrow("Unknown index [does-not-exist]");
    await expect(runEsql(client, query)).rejects.toThrow(`Query: ${query}`);
  });

  it("says to start the stack when Elasticsearch is unreachable", async () => {
    // maxRetries: 0 makes it fail at once. By default the client retries a few times, which is
    // right in production but would make this test take longer than its time limit.
    const unreachable = new Client({ node: "http://localhost:1", maxRetries: 0 });
    await expect(runEsql(unreachable, "ROW a = 1")).rejects.toThrow("docker compose up -d");
  });
});