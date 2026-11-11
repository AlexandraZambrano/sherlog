// Checks that the Tool contract can be followed by a real tool: here, a fake one that needs no Elasticsearch.
import { describe, it, expect } from "vitest";
import type { Client } from "@elastic/elasticsearch";
import { doubleTool } from "./fake-double-tool";
import { DATA_STREAMS } from "../elastic/schema";

describe("Tool contract", () => {
  it("returns the answer together with the query that produced it", async () => {
    // The fake tool never touches Elasticsearch, so the client can be a placeholder.
    const deps = { client: undefined as unknown as Client, dataStreams: DATA_STREAMS };
    const result = await doubleTool.run({ n: 21 }, deps);
    expect(result.data.doubled).toBe(42);
    expect(result.query).toBe("FROM nothing");
  });

  it("carries the schema that checks what the model sends", () => {
    expect(doubleTool.inputSchema.parse({ n: 21 })).toEqual({ n: 21 });
    expect(doubleTool.inputSchema.safeParse({ n: "21" }).success).toBe(false);
  });
});
