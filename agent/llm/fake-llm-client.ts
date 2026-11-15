// A fake model for tests of the agent: it answers with a script, in order, and records what it was asked.
import type { ChatMessage, LlmClient, LlmReply, ToolDescription } from "./llm-client";

/** One question the agent asked the model. */
export type FakeLlmRequest = {
  readonly messages: readonly ChatMessage[];
  readonly tools: readonly ToolDescription[];
};

/** A fake model, together with the list of what it was asked. */
export type FakeLlmClient = LlmClient & { readonly requests: readonly FakeLlmRequest[] };

/** Creates a fake model that gives each reply of the script once, in order. When the script runs out it fails loudly. */
export function createFakeLlmClient(replies: readonly LlmReply[]): FakeLlmClient {
  const requests: FakeLlmRequest[] = [];
  return {
    requests,
    chat: (messages, tools) => {
      const reply = replies[requests.length];
      // The messages are copied, so a later change of the conversation cannot rewrite what was asked.
      requests.push({ messages: [...messages], tools });
      return reply === undefined
        ? Promise.reject(new Error("The fake model has no more replies in its script"))
        : Promise.resolve(reply);
    },
  };
}
