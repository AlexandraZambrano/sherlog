// Checks how a tool call written by the model is checked and run.
import { describe, it, expect, vi } from "vitest";
import type { Client } from "@elastic/elasticsearch";
import type { ToolCall } from "../llm/llm-client";
import { DATA_STREAMS } from "../elastic/schema";
import { doubleTool } from "./fake-double-tool";
import { listServices } from "./list-services";
import { errorRate } from "./error-rate";
import { runModelToolCall } from "./run-model-tool-call";

// The fake tools never touch Elasticsearch, so the client can be a placeholder.
const deps = { client: undefined as unknown as Client, dataStreams: DATA_STREAMS };

/** A tool call as the model writes it: the arguments are JSON text. */
const callOf = (name: string, args: string): ToolCall => ({ id: "call_1", name, arguments: args });

describe("runModelToolCall", () => {
  it("runs the tool the model asked for and returns its answer with the query", async () => {
    const outcome = await runModelToolCall([doubleTool], callOf("double", '{"n":21}'), deps);

    expect(outcome).toEqual({ status: "ok", query: "FROM nothing", data: { doubled: 21 * 2 } });
  });

  it("tells the model which tools exist when it asks for one that does not", async () => {
    const outcome = await runModelToolCall([doubleTool], callOf("triple", '{"n":21}'), deps);

    expect(outcome.status).toBe("error");
    expect(outcome).toHaveProperty("message", expect.stringContaining("double"));
  });

  it("asks for valid JSON when the arguments are broken", async () => {
    const outcome = await runModelToolCall([doubleTool], callOf("double", "{n: 21"), deps);

    expect(outcome.status).toBe("error");
    expect(outcome).toHaveProperty("message", expect.stringContaining("JSON"));
  });

  it("says what was expected when an argument has the wrong type", async () => {
    const outcome = await runModelToolCall([doubleTool], callOf("double", '{"n":"21"}'), deps);

    expect(outcome.status).toBe("error");
    expect(outcome).toHaveProperty("message", expect.stringContaining("expected number"));
  });

  it("names the path of a wrong argument that sits inside another", async () => {
    const badTime = '{"window":{"from":"yesterday","to":"2026-10-14T20:00:00Z"}}';
    const outcome = await runModelToolCall([listServices], callOf("list_services", badTime), deps);

    expect(outcome).toHaveProperty("message", expect.stringContaining("window.from"));
  });

  it("does not run the tool when the arguments are not valid", async () => {
    const run = vi.fn(() => Promise.resolve({ query: "FROM nothing", data: { doubled: 0 } }));

    await runModelToolCall([{ ...doubleTool, run }], callOf("double", '{"n":"21"}'), deps);

    expect(run).not.toHaveBeenCalled();
  });

  it("turns an error thrown by the tool into a message for the model", async () => {
    // Each window is valid on its own, but the baseline overlaps the window. The tool rejects that.
    const overlapping = JSON.stringify({
      service: "payment",
      window: { from: "2026-10-14T20:00:00Z", to: "2026-10-14T20:08:00Z" },
      baseline: { from: "2026-10-14T19:55:00Z", to: "2026-10-14T20:05:00Z" },
    });

    const outcome = await runModelToolCall([errorRate], callOf("error_rate", overlapping), deps);

    expect(outcome.status).toBe("error");
    expect(outcome).toHaveProperty("message", expect.stringContaining("overlaps"));
  });
});
