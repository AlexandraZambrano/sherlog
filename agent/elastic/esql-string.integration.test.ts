// Checks that Elasticsearch reads back, unchanged, the text that esqlString escaped.
import { describe, it, expect } from "vitest";
import { createElasticClient } from "./client";
import { esqlString } from "./esql-string";
import { runEsql } from "./run-esql";

const client = createElasticClient(process.env.ELASTICSEARCH_URL ?? "http://localhost:9200");

describe("esqlString against Elasticsearch", () => {
  it.each(['x" OR true OR "', String.raw`C:\temp`, "a\nb", "tab\there", 'say "hi"'])(
    "Elasticsearch reads %j back unchanged",
    async (value) => {
      const rows = await runEsql<{ a: string }>(client, `ROW a = ${esqlString(value)}`);
      expect(rows).toEqual([{ a: value }]);
    },
  );
});