// A tiny fake of an OpenAI-compatible chat API (what Groq and Ollama speak), for tests only.
// It plays a script of replies in order and records every request, so no key and no tokens are needed.
import { createServer, type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

/** One step of the script: the reply the fake sends to the next request. */
export type ScriptedResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;   // for example { "retry-after": "0" }
};

/** What the client sent, kept so a test can check it. */
export type ReceivedRequest = {
  readonly method: string;
  readonly path: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: unknown;
};

/** A running fake server. Call `close` when the test ends. */
export type FakeLlmServer = {
  readonly baseUrl: string;                          // where the client under test must point
  readonly requests: readonly ReceivedRequest[];     // grows as requests arrive
  readonly close: () => Promise<void>;
};

/** Reads the whole request body and parses it as JSON (`undefined` when the body is empty). */
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text === "" ? undefined : (JSON.parse(text) as unknown);
}

/** Starts a fake server on a free port that answers with `script`, one step per request. */
export async function startFakeLlmServer(script: readonly ScriptedResponse[]): Promise<FakeLlmServer> {
  // The one mutable thing: the log of what arrived. It lives inside the fake and is only read from outside.
  const requests: ReceivedRequest[] = [];

  const server = createServer((request, response) => {
    void (async () => {
      const body = await readJsonBody(request);

      // The step is chosen by how many requests came before this one.
      const scripted = script[requests.length] ?? {
        status: 500,
        body: { error: "fake LLM server: the script has no more replies" },   // fail loudly, never hang
      };
      requests.push({ method: request.method ?? "", path: request.url ?? "", headers: request.headers, body });

      response.writeHead(scripted.status, { "content-type": "application/json", ...scripted.headers });
      response.end(JSON.stringify(scripted.body));
    })().catch(() => {
      response.writeHead(400);   // for example, a body that is not valid JSON
      response.end();
    });
  });

  // Port 0 asks the operating system for a free port, so tests never clash.
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();   // `fetch` keeps connections open, which would make `close` wait
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}