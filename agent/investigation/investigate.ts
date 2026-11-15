// The investigation loop: ask the model, run the tools it asks for, give it the results, repeat until it answers.
import type { ChatMessage, LlmClient, ToolCall } from "../llm/llm-client";
import { describeTool } from "../tools/describe-tool";
import { runModelToolCall, type AnyTool } from "../tools/run-model-tool-call";
import type { ToolDeps } from "../tools/tool";

/** What the loop needs: the model, the tools, what the tools need, and the conversation to start from. */
export type InvestigationInput = {
  readonly llm: LlmClient;
  readonly tools: readonly AnyTool[];
  readonly deps: ToolDeps;
  readonly messages: readonly ChatMessage[];
};

/** What the loop gives back: the final answer, and the whole conversation that led to it. */
export type Investigation = {
  readonly answer: string | null;
  readonly messages: readonly ChatMessage[];
};

/** Runs the tools the model asked for, one after another, and writes each result as a `tool` message. */
async function runToolCalls(
  calls: readonly ToolCall[],
  tools: readonly AnyTool[],
  deps: ToolDeps,
): Promise<readonly ChatMessage[]> {
  const results: ChatMessage[] = [];
  for (const call of calls) {
    const outcome = await runModelToolCall(tools, call, deps);
    // The model reads text, so the outcome is written as JSON. `toolCallId` ties it to the request that asked for it.
    results.push({ role: "tool", toolCallId: call.id, content: JSON.stringify(outcome) });
  }
  return results;
}

/** Runs one investigation. It ends when the model answers without asking for a tool. */
export async function investigate(input: InvestigationInput): Promise<Investigation> {
  const reply = await input.llm.chat(input.messages, input.tools.map(describeTool));
  const messages: readonly ChatMessage[] = [
    ...input.messages,
    { role: "assistant", content: reply.content, toolCalls: [...reply.toolCalls] },
  ];

  if (reply.toolCalls.length === 0) {
    return { answer: reply.content, messages };
  }

  const results = await runToolCalls(reply.toolCalls, input.tools, input.deps);
  return investigate({ ...input, messages: [...messages, ...results] });
}
