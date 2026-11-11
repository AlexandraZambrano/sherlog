// Runs a tool call written by the model: finds the tool, checks the arguments, then runs it.
import type { z } from "zod";
import type { ToolCall } from "../llm/llm-client";
import type { Tool, ToolDeps } from "./tool";

/**
 * A tool, whatever its input. A list of tools mixes different inputs, and TypeScript has no type for
 * "any input" that fits them all, so `any` is used here. It stays safe because each tool's own schema
 * checks the input before the tool runs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, unknown>;

/** What a model tool call gives back: the tool's answer with its query, or a message the model can act on. */
export type ToolCallOutcome =
  | { readonly status: "ok"; readonly query: string; readonly data: unknown }
  | { readonly status: "error"; readonly message: string };

/** Reads JSON text. The text is written by the model, so it can be broken: that is a result, not a crash. */
function parseJson(text: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** One line per problem, with the path of the field (for example "window.from") so the model knows what to fix. */
function describeProblems(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.map(String).join(".") || "arguments"}: ${issue.message}`).join("; ");
}

/** Runs the tool the model asked for. A mistake of the model comes back as an `error` outcome, it is never thrown. */
export async function runModelToolCall(tools: readonly AnyTool[], call: ToolCall, deps: ToolDeps): Promise<ToolCallOutcome> {
  const tool = tools.find((candidate) => candidate.name === call.name);
  if (tool === undefined) {
    const names = tools.map((candidate) => candidate.name).join(", ");
    return { status: "error", message: `Unknown tool "${call.name}". The tools you can use are: ${names}.` };
  }

  const json = parseJson(call.arguments);
  if (!json.ok) {
    return { status: "error", message: `The arguments of "${call.name}" are not valid JSON. Send them as a JSON object.` };
  }

  // The tool's own schema checks the arguments. Nothing the model wrote reaches `run` before this passes.
  const checked = tool.inputSchema.safeParse(json.value);
  if (!checked.success) {
    return { status: "error", message: `Invalid arguments for "${call.name}". ${describeProblems(checked.error)}` };
  }

  try {
    const result = await tool.run(checked.data, deps);
    return { status: "ok", query: result.query, data: result.data };
  } catch (error) {
    // A tool can still fail after its arguments passed, for example when two windows overlap. Anything can be thrown in JavaScript.
    const reason = error instanceof Error ? error.message : String(error);
    return { status: "error", message: `The tool "${call.name}" failed: ${reason}` };
  }
}
