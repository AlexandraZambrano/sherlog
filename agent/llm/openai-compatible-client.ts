// The real model client: speaks the OpenAI chat-completions format, which Groq and Ollama both accept.
import type { ChatMessage, LlmClient, LlmReply, ToolCall, ToolDescription } from "./llm-client";

/** Where and how to reach one provider. The key comes from the environment, never from the code. */
export type OpenAiCompatibleSettings = {
  readonly baseUrl: string;   // for example "https://api.groq.com/openai/v1"
  readonly apiKey: string;
  readonly model: string;
  readonly sleep?: (milliseconds: number) => Promise<void>
};

/** A tool request as the provider writes it: the name and arguments sit inside `function`. */
type WireToolCall = {
  readonly id: string;
  readonly function: { readonly name: string; readonly arguments: string };
};

/** The part of the provider's reply that we read. */
type WireReply = {
  readonly choices: readonly {
    readonly message: { readonly content: string | null; readonly tool_calls?: readonly WireToolCall[] };
  }[];
  readonly usage: { readonly prompt_tokens: number; readonly completion_tokens: number };
};

/** Wraps one of our tool descriptions in the shape the provider expects. */
function toWireTool(tool: ToolDescription) {
  return {
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  };
}

/** Wraps one of our tool calls in the shape the provider expects: `name` and `arguments` go inside `function`. */
function toWireToolCall(call: ToolCall) {
  return { id: call.id, type: "function", function: { name: call.name, arguments: call.arguments } };
}

/** Translates one of our messages to the provider's format (snake_case names, tool calls wrapped). */
function toWireMessage(message: ChatMessage) {
  switch (message.role) {
    case "assistant":
      // A text-only answer has no tool calls; some providers reject an empty `tool_calls` list.
      return {
        role: message.role,
        content: message.content,
        ...(message.toolCalls.length === 0 ? {} : { tool_calls: message.toolCalls.map(toWireToolCall) }),
      };
    case "tool":
      return { role: message.role, tool_call_id: message.toolCallId, content: message.content };
    default:
      return { role: message.role, content: message.content };
  }
}

/** Checks that a JSON value from the provider has the parts of a chat completion that we read. */
function isWireReply(value: unknown): value is WireReply {
  const candidate = value as Partial<WireReply> | null;
  return (
    Array.isArray(candidate?.choices) &&
    typeof candidate.usage?.prompt_tokens === "number" &&
    typeof candidate.usage.completion_tokens === "number"
  );
}

/** How many times a rate-limited request is repeated before we stop asking. */
const MAX_RETRIES = 3;

/** The real wait: used in production, replaced by a fake in tests. */
const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** How long to wait when the provider does not say. */
const DEFAULT_RETRY_DELAY_MILLISECONDS = 1000;

/** How long the provider asked us to wait. The `retry-after` header is in seconds. */
function retryDelayMilliseconds(response: Response): number {
  const seconds = response.headers.get("retry-after");
  return seconds === null ? DEFAULT_RETRY_DELAY_MILLISECONDS : Number(seconds) * 1000;
}

/** Sends the request; on a 429 (rate limit) it waits and sends it again, up to MAX_RETRIES times. */
async function sendWithRetry(
  send: () => Promise<Response>,
  sleep: (milliseconds: number) => Promise<void>,
  retriesLeft = MAX_RETRIES,
): Promise<Response> {
  const response = await send();
  if (response.status !== 429 || retriesLeft === 0) {
    return response;
  }
  await sleep(retryDelayMilliseconds(response));
  return sendWithRetry(send, sleep, retriesLeft - 1);
}

/** Creates a client for any provider that speaks the OpenAI chat-completions format. */
export function createOpenAiCompatibleClient(settings: OpenAiCompatibleSettings): LlmClient {
  return {
    chat: async (messages, tools): Promise<LlmReply> => {
      const send = () => fetch(`${settings.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({
          model: settings.model,
          messages: messages.map(toWireMessage),
          // Some providers reject an empty `tools` list, so the key is only sent when there are tools.
          ...(tools.length === 0 ? {} : { tools: tools.map(toWireTool) }),
        }),
      });

      const response = await sendWithRetry(send, settings.sleep ?? wait);

      // After the retries, a failed answer is reported as it is: the caller needs to know what the provider said.
      if (!response.ok) {
        throw new Error(`The LLM provider answered HTTP ${String(response.status)}`);
      }

      // The provider is outside our control: check the shape instead of trusting it.
      const reply: unknown = await response.json();
      if (!isWireReply(reply)) {
        throw new Error("The LLM provider sent an unexpected reply");
      }

      const message = reply.choices[0]?.message;
      return {
        content: message?.content ?? null,
        // Providers omit `tool_calls` when the model asks for nothing; flatten `function` into our ToolCall.
        toolCalls: (message?.tool_calls ?? []).map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        })),
        usage: { promptTokens: reply.usage.prompt_tokens, completionTokens: reply.usage.completion_tokens },
      };
    },
  };
}
