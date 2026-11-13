// Checks the investigation loop with a scripted model, so no key, no network and no tokens are used.
import { describe, it, expect } from "vitest";
import type { Client } from "@elastic/elasticsearch";
import { DATA_STREAMS } from "../elastic/schema";
import type { ChatMessage } from "../llm/llm-client";
import { createFakeLlmClient } from "../llm/fake-llm-client";
import { doubleTool } from "../tools/fake-double-tool";
import { investigate } from "./investigate";

// The fake tools never touch Elasticsearch, so the client can be a placeholder.
const deps = { client: undefined as unknown as Client, dataStreams: DATA_STREAMS };

const usage = { promptTokens: 1, completionTokens: 1 };
const startingMessages: readonly ChatMessage[] = [{ role: "user", content: "Errors rose in payment at 20:00 UTC." }];

/** The message the loop writes when `doubleTool` ran well: the tool's answer, as JSON, tied to the request. */
const doubledResult = (toolCallId: string, doubled: number): ChatMessage => ({
  role: "tool",
  toolCallId,
  content: JSON.stringify({ status: "ok", query: "FROM nothing", data: { doubled } }),
});

describe("investigate", () => {
  it("returns the answer of the model when it asks for no tool", async () => {
    const llm = createFakeLlmClient([{ content: "Not enough evidence.", toolCalls: [], usage }]);

    const result = await investigate({ llm, tools: [doubleTool], deps, messages: startingMessages });

    expect(result.answer).toBe("Not enough evidence.");
    expect(llm.requests).toHaveLength(1);
  });

  it("describes the tools to the model", async () => {
    const llm = createFakeLlmClient([{ content: "Done.", toolCalls: [], usage }]);

    await investigate({ llm, tools: [doubleTool], deps, messages: startingMessages });

    expect(llm.requests[0]?.tools.map((tool) => tool.name)).toEqual(["double"]);
  });

  it("keeps the whole conversation, with the answer at the end", async () => {
    const llm = createFakeLlmClient([{ content: "Not enough evidence.", toolCalls: [], usage }]);

    const result = await investigate({ llm, tools: [doubleTool], deps, messages: startingMessages });

    expect(result.messages).toEqual([
      ...startingMessages,
      { role: "assistant", content: "Not enough evidence.", toolCalls: [] },
    ]);
  });

  it("runs the tool the model asks for and gives the result back to the model", async () => {
    const llm = createFakeLlmClient([
      { content: null, toolCalls: [{ id: "call_1", name: "double", arguments: '{"n":21}' }], usage },
      { content: "Done.", toolCalls: [], usage },
    ]);

    const result = await investigate({ llm, tools: [doubleTool], deps, messages: startingMessages });

    expect(result.answer).toBe("Done.");
    expect(llm.requests).toHaveLength(2);
    // The second question ends with the result of the tool, tied to the request that asked for it.
    expect(llm.requests[1]?.messages.at(-1)).toEqual(doubledResult("call_1", 42));
  });

  it("keeps the whole conversation in order: request, tool call, result, answer", async () => {
    const toolCall = { id: "call_1", name: "double", arguments: '{"n":21}' };
    const llm = createFakeLlmClient([
      { content: null, toolCalls: [toolCall], usage },
      { content: "Done.", toolCalls: [], usage },
    ]);

    const result = await investigate({ llm, tools: [doubleTool], deps, messages: startingMessages });

    expect(result.messages).toEqual([
      ...startingMessages,
      { role: "assistant", content: null, toolCalls: [toolCall] },
      doubledResult("call_1", 42),
      { role: "assistant", content: "Done.", toolCalls: [] },
    ]);
  });

  it("runs the several tools of one reply in the order the model asked for them", async () => {
    const llm = createFakeLlmClient([
      {
        content: null,
        toolCalls: [
          { id: "call_1", name: "double", arguments: '{"n":1}' },
          { id: "call_2", name: "double", arguments: '{"n":2}' },
        ],
        usage,
      },
      { content: "Done.", toolCalls: [], usage },
    ]);

    await investigate({ llm, tools: [doubleTool], deps, messages: startingMessages });

    // The last two messages of the second question are the two results, one per request.
    expect(llm.requests[1]?.messages.slice(-2)).toEqual([doubledResult("call_1", 2), doubledResult("call_2", 4)]);
  });

  it("tells the model when a tool call was wrong and goes on with the investigation", async () => {
    const llm = createFakeLlmClient([
      { content: null, toolCalls: [{ id: "call_1", name: "triple", arguments: '{"n":1}' }], usage },
      { content: "Done.", toolCalls: [], usage },
    ]);

    const result = await investigate({ llm, tools: [doubleTool], deps, messages: startingMessages });

    // The mistake is not thrown: it goes to the model as a result, and the loop carries on.
    expect(result.answer).toBe("Done.");
    expect(llm.requests[1]?.messages.at(-1)).toMatchObject({ role: "tool", toolCallId: "call_1" });
    expect(llm.requests[1]?.messages.at(-1)).toHaveProperty("content", expect.stringContaining('"status":"error"'));
  });
});
