// Checks that a tool is described to the model with its name, its purpose and the arguments it accepts.
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { describeTool } from "./describe-tool";
import type { Tool } from "./tool";
import { listServices } from "./list-services";
import { errorRate } from "./error-rate";
import { searchLogs } from "./search-logs";

// A fake tool, so the first tests do not depend on a real one.
const doubleTool: Tool<{ n: number }, { doubled: number }> = {
  name: "double",
  description: "Doubles a number. Only used to test describeTool.",
  inputSchema: z.object({ n: z.number() }),
  run: (input) => Promise.resolve({ query: "FROM nothing", data: { doubled: input.n * 2 } }),
};

describe("describeTool", () => {
  it("gives the model the name, the description and the arguments of the tool", () => {
    expect(describeTool(doubleTool)).toEqual({
      name: "double",
      description: "Doubles a number. Only used to test describeTool.",
      parameters: {
        type: "object",
        properties: { n: { type: "number" }},
        required: ["n"]
      }
    });
  });

  it("leaves out the $schema line, which the model does not need", () => {
    expect(describeTool(doubleTool).parameters).not.toHaveProperty("$schema");
  });

  it("marks only the required arguments as required", () => {
    const parameters = describeTool(searchLogs).parameters;

    expect(parameters.required).toEqual(["window"]);
    expect(Object.keys(parameters.properties as object)).toEqual(["window", "service", "text", "problemsOnly", "limit"]);
  });

  it("explains every argument of the real tools, so the model knows what to write", () => {
    for (const tool of [listServices, errorRate, searchLogs]) {
      const { properties } = describeTool(tool).parameters as { properties: Record<string, { description?: string }> };

      for (const [name, property] of Object.entries(properties)) {
        expect(property.description, `${tool.name}.${name}`).toEqual(expect.any(String));
      }
    }
  });
});
