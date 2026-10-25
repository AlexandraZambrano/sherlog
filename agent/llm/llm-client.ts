// The contract every model client follows. The agent depends on this, never on Groq or Ollama.

/** A request from the model to run one of our tools. */
export type ToolCall = {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;   // JSON text written by the model: untrusted until validated
};

/** One line of the conversation. The `role` says who speaks. */
export type ChatMessage =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string | null; readonly toolCalls: ToolCall[] }
  | { readonly role: "tool"; readonly toolCallId: string; readonly content: string };

/** How we describe a tool to the model. */
export type ToolDescription = {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;   // JSON Schema of the input
};

/** What the model answers, and what the call cost. */
export type LlmReply = {
  readonly content: string | null;
  readonly toolCalls: readonly ToolCall[];
  readonly usage: { readonly promptTokens: number; readonly completionTokens: number };
};

/** The phone line: send the conversation and the tools, get a reply. */
export type LlmClient = {
  readonly chat: (messages: readonly ChatMessage[], tools: readonly ToolDescription[]) => Promise<LlmReply>;
};