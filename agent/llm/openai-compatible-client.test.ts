// Checks the OpenAI-compatible client against the fake server: no key, no network, no tokens.
import { afterEach, describe, it, expect } from "vitest";
import { startFakeLlmServer, type FakeLlmServer } from "./fake-llm-server";
import { createOpenAiCompatibleClient, type OpenAiCompatibleSettings } from "./openai-compatible-client";

let server: FakeLlmServer | undefined;

// Always close the server, even if a test fails.
afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** A well-formed reply, in the format the real APIs use on the wire. */
const textReply = {
  choices: [{ message: { role: "assistant", content: "ok" } }],
  usage: { prompt_tokens: 1, completion_tokens: 1 },
};

/** Settings that point to the fake server. Each test adds only what makes it different. */
function settingsFor(server: FakeLlmServer, extra: Partial<OpenAiCompatibleSettings> = {}): OpenAiCompatibleSettings {
  return { baseUrl: server.baseUrl, apiKey: "test-key", model: "test-model", ...extra };
}

/** A fake wait: it writes down how long it was asked to wait, and returns at once. */
function recordingSleep() {
  const waits: number[] = [];
  const sleep = (milliseconds: number) => {
    waits.push(milliseconds);
    return Promise.resolve();
  };
  return { waits, sleep };
}

describe("createOpenAiCompatibleClient", () => {
  it("sends the key and the conversation in the OpenAI format", async () => {
    server = await startFakeLlmServer([{ status: 200, body: textReply }]);
    const client = createOpenAiCompatibleClient(settingsFor(server));

    await client.chat([{ role: "user", content: "hi" }], []);

    const request = server.requests[0];
    expect(request?.method).toBe("POST");
    expect(request?.path).toBe("/chat/completions");
    expect(request?.headers.authorization).toBe("Bearer test-key");
    expect(request?.body).toEqual({ model: "test-model", messages: [{ role: "user", content: "hi" }] });
  });

  it("returns the tool calls the model asks for", async () => {
    server = await startFakeLlmServer([
      {
        status: 200,
        body: {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,   // the model asked for a tool and said no text
                tool_calls: [
                  { id: "call_1", type: "function", function: { name: "error_rate", arguments: '{"service":"payment"}' } },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        },
      },
    ]);
    const client = createOpenAiCompatibleClient(settingsFor(server));

    const reply = await client.chat([{ role: "user", content: "Errors rose at 20:00 UTC." }], []);

    expect(reply.content).toBe(null);
    expect(reply.toolCalls).toEqual([{ id: "call_1", name: "error_rate", arguments: '{"service":"payment"}' }]);
    expect(reply.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
  });

  it("describes the tools to the model", async () => {
    server = await startFakeLlmServer([{ status: 200, body: textReply }]);
    const client = createOpenAiCompatibleClient(settingsFor(server));

    await client.chat(
      [{ role: "user", content: "hi" }],
      [
        {
          name: "error_rate",
          description: "Share of failed requests of a service.",
          parameters: { type: "object", properties: { service: { type: "string" } } },
        },
      ],
    );

    expect(server.requests[0]?.body).toEqual({
      model: "test-model",
      messages: [{ role: "user", content: "hi" }],
      tools: [{ type: "function", function: { name: "error_rate", description: "Share of failed requests of a service.", parameters: { type: "object", properties: { service: { type: "string" } } } } }],
    });
  });

  it("sends the tool requests and tool results of the conversation", async () => {
    server = await startFakeLlmServer([{ status: 200, body: textReply }]);
    const client = createOpenAiCompatibleClient(settingsFor(server));

    await client.chat(
      [
        { role: "user", content: "Errors rose at 20:00 UTC." },
        {
          role: "assistant",
          content: null,
          toolCalls: [{ id: "call_1", name: "error_rate", arguments: '{"service":"payment"}' }],
        },
        { role: "tool", toolCallId: "call_1", content: '{"rate":0.44}' },
      ],
      [],
    );

    expect(server.requests[0]?.body).toEqual({
      model: "test-model",
      messages: [
        { role: "user", content: "Errors rose at 20:00 UTC." },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "error_rate", arguments: '{"service":"payment"}' } },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: '{"rate":0.44}' },
      ],
    });
  });

  it("sends a text-only answer of the model without an empty tool_calls list", async () => {
    server = await startFakeLlmServer([{ status: 200, body: textReply }]);
    const client = createOpenAiCompatibleClient(settingsFor(server));

    await client.chat(
      [
        { role: "user", content: "hi" },
        { role: "assistant", content: "Looking into it.", toolCalls: [] },
        { role: "user", content: "go on" },
      ],
      [],
    );

    expect(server.requests[0]?.body).toEqual({
      model: "test-model",
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "Looking into it." },
        { role: "user", content: "go on" },
      ],
    });
  });

  it("waits for the time the provider asks and retries after a 429", async () => {
    server = await startFakeLlmServer([
      { status: 429, headers: { "retry-after": "2" }, body: { error: "rate limited" } },
      { status: 200, body: textReply },
    ]);

    const { waits, sleep } = recordingSleep();
    const client = createOpenAiCompatibleClient(settingsFor(server, { sleep }));

    const reply = await client.chat([{ role: "user", content: "hi" }], []);

    expect(reply.content).toBe("ok");
    expect(server.requests).toHaveLength(2);
    expect(waits).toEqual([2000]);
  });


  it("waits one second when the provider does not say how long", async () => {
    server = await startFakeLlmServer([
      { status: 429, body: { error: "rate limited" } },   // no retry-after header this time
      { status: 200, body: textReply },
    ]);
    const { waits, sleep } = recordingSleep();
    const client = createOpenAiCompatibleClient(settingsFor(server, { sleep }));

    await client.chat([{ role: "user", content: "hi" }], []);

    expect(waits).toEqual([1000]);
  });

  it("gives up with a clear error when the provider keeps answering 429", async () => {
    const rateLimited = { status: 429, body: { error: "rate limited" } };
    // Five 429s are scripted: if the client asked more than it should, the count below shows it.
    server = await startFakeLlmServer([rateLimited, rateLimited, rateLimited, rateLimited, rateLimited]);
    const client = createOpenAiCompatibleClient(settingsFor(server, { sleep: () => Promise.resolve() }));

    await expect(client.chat([{ role: "user", content: "hi" }], [])).rejects.toThrow("429");
    expect(server.requests).toHaveLength(4);
  });

  it("does not retry other errors and reports their status", async () => {
    // A 200 is scripted after the 401: if the client retried, it would get it and the test would catch it.
    server = await startFakeLlmServer([
      { status: 401, body: { error: "invalid api key" } },
      { status: 200, body: textReply },
    ]);
    const { waits, sleep } = recordingSleep();
    const client = createOpenAiCompatibleClient(settingsFor(server, { sleep }));

    await expect(client.chat([{ role: "user", content: "hi" }], [])).rejects.toThrow("401");
    expect(server.requests).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it("fails with a clear error when a 200 reply is not a chat completion", async () => {
    server = await startFakeLlmServer([
      { status: 200, body: { unexpected: true } },                          // no choices, no usage
      { status: 200, body: { choices: [{ message: { content: "ok" } }] } },   // choices, but no usage
    ]);
    const client = createOpenAiCompatibleClient(settingsFor(server));
    const ask = () => client.chat([{ role: "user", content: "hi" }], []);

    await expect(ask()).rejects.toThrow("unexpected reply");
    await expect(ask()).rejects.toThrow("unexpected reply");
  });

});
