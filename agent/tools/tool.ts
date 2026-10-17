// The contract every Sherlog tool follows: what goes in, what comes out.
import type { Client } from "@elastic/elasticsearch";

/**
 * What a tool needs from the outside world. It is passed in and never created inside a tool,
 * so tests can pass a fake one.
 */
export type ToolDeps = {
  readonly client: Client;
};

/** What every tool returns: the answer, and the exact query that produced it. */
export type ToolResult<Output> = {
  readonly query: string;   
  readonly data: Output;    
};

/** A tool: a named question the agent can ask Elasticsearch. */
export type Tool<Input, Output> = {
  readonly name: string;          // for example "error_rate"
  readonly description: string;   // tells the agent when to use it
  readonly run: (input: Input, deps: ToolDeps) => Promise<ToolResult<Output>>;   // asynchronous, returns a ToolResult<Output>
};