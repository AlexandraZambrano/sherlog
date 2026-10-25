// Checks the fake OpenAI-compatible server: it plays its script in order and records what it receives.
import { afterEach, describe, it, expect } from "vitest";
import { startFakeLlmServer, type FakeLlmServer } from "./fake-llm-server";

let server: FakeLlmServer | undefined;

// Always close the server, even if a test fails, so no port stays open.
afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** Sends one chat request to the fake, like the real client will. */
function post(baseUrl: string, body: unknown) {
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-key" },
    body: JSON.stringify(body),
  });
}

describe("startFakeLlmServer", () => {
  it("answers with the scripted replies, in order", async () => {
    server = await startFakeLlmServer([
      { status: 429, headers: { "retry-after": "0" }, body: { error: "rate limited" } },
      { status: 200, body: { choices: [] } },
    ]);

    const first = await post(server.baseUrl, { model: "m" });
    const second = await post(server.baseUrl, { model: "m" });

    expect(first.status).toBe(429);
    expect(first.headers.get("retry-after")).toBe("0");
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ choices: [] });
  });

  it("records what the client sent", async () => {
    server = await startFakeLlmServer([{ status: 200, body: {} }]);

    await post(server.baseUrl, { model: "m", messages: [] });

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.path).toBe("/chat/completions");
    expect(server.requests[0]?.headers.authorization).toBe("Bearer test-key");
    expect(server.requests[0]?.body).toEqual({ model: "m", messages: [] });
  });

  it("fails loudly when the client asks for more replies than the script has", async () => {
    server = await startFakeLlmServer([]);

    const response = await post(server.baseUrl, {});

    expect(response.status).toBe(500);
  });
});