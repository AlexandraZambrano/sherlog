// A fake tool for tests: it doubles a number and needs no Elasticsearch.
import { z } from "zod";
import type { Tool } from "./tool";

/** Takes a number and returns its double, together with the query it "ran". */
export const doubleTool: Tool<{ n: number }, { doubled: number }> = {
  name: "double",
  description: "Doubles a number. Only used in tests.",
  inputSchema: z.object({ n: z.number() }),
  run: (input) => Promise.resolve({ query: "FROM nothing", data: { doubled: input.n * 2 } }),
};
