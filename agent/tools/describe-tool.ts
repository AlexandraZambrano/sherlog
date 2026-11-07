// Describes a tool to the model: its name, what it is for, and the arguments it accepts.
import { z } from "zod";
import type { ToolDescription } from "../llm/llm-client";
import type { Tool } from "./tool";

/**
 * Turns a tool into the description the model reads. The arguments come from the same schema
 * that later checks what the model sends, so the two cannot drift apart.
 */
export function describeTool(tool: Pick<Tool<unknown, unknown>, "name" | "description" | "inputSchema">): ToolDescription {
  const schema = z.toJSONSchema(tool.inputSchema, { io: "input" });
  // The `$schema` line names the JSON Schema version. The model does not need it, and some providers reject it.
  const parameters = Object.fromEntries(Object.entries(schema).filter(([key]) => key !== "$schema"));
  return { name: tool.name, description: tool.description, parameters };
}
