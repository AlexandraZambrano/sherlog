// Checks that the LlmClient contract can be followed by a fake model, and used through the type alone.
import { describe, it, expect } from "vitest";
import type { ChatMessage, LlmClient, LlmReply } from "./llm-client";

// A fake model: always asks for the error_rate tool. It needs no network and no key.
const fakeModel: LlmClient = {
  chat: () =>
    Promise.resolve({
      content: null,
      toolCalls: [{ id: "call_1", name: "error_rate", arguments: '{"service":"payment"}' }],
      usage: { promptTokens: 10, completionTokens: 5 },
    }),
};

describe("LlmClient contract", () => {
  it("lets a fake model answer a conversation with a tool call", async () => {
    const messages: readonly ChatMessage[] = [
      { role: "system", content: "Look at metrics first." },
      { role: "user", content: "Errors rose at 20:00 UTC." },
    ];

    const reply: LlmReply = await fakeModel.chat(messages, []);

    expect(reply.content).toBeNull();
    expect(reply.toolCalls).toEqual([{ id: "call_1", name: "error_rate", arguments: '{"service":"payment"}' }]);
    expect(reply.usage.promptTokens + reply.usage.completionTokens).toBe(15);
  });

  it("lets a conversation hold the model's tool requests and our answers to them", () => {
    const messages: readonly ChatMessage[] = [
      { role: "user", content: "Errors rose at 20:00 UTC." },
      {
        role: "assistant",
        content: null, 
        toolCalls: [
          { id: "call_1", name: "error_rate", arguments: '{"service":"payment"}' },
          { id: "call_2", name: "search_logs", arguments: '{"service":"payment"}' },
        ],
      },
      { role: "tool", toolCallId: "call_1", content: '{"rate":0.44}' },
    ];

    expect(messages).toHaveLength(3);
  });
});