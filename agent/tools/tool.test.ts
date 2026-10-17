// Checks that the Tool contract can be followed by a real tool: here, a fake one that needs no Elasticsearch.
import { describe, it, expect } from "vitest";
import type { Client } from "@elastic/elasticsearch";
import type { Tool } from "./tool";

// A fake tool: takes a number and returns its double, together with the query it "ran".
const doubleTool: Tool<{ n: number }, { doubled: number }> = {
  name: "double",
  description: "Doubles a number. Only used to test the Tool contract.",
  run: (input) => Promise.resolve({ query: "FROM nothing", data: { doubled: input.n * 2 } }),
};

describe("Tool contract", () => {
  it("returns the answer together with the query that produced it", async () => {
    // The fake tool never touches Elasticsearch, so the client can be a placeholder.
    const deps = { client: undefined as unknown as Client };
    const result = await doubleTool.run({ n: 21 }, deps);
    expect(result.data.doubled).toBe(42);
    expect(result.query).toBe("FROM nothing");
  });
});