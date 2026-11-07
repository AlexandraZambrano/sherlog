// The search_logs tool: what the services said, grouped by message.
import { FIELDS } from "../elastic/schema";
import { esqlString } from "../elastic/esql-string";
import { toEsqlCondition, type TimeWindow } from "./time-window";
import { runEsql } from "../elastic/run-esql";
import type { Tool } from "./tool";
import { z } from "zod";
import { timeWindowInput } from "./model-input";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
// Log levels are written in different ways (WARN, warn...), so they are compared in capitals.
const PROBLEM_LEVELS = ["WARN", "WARNING", "ERROR", "FATAL", "CRITICAL"];

/** What to ask. Everything except the window is optional. */
export type SearchLogsInput = {
  readonly window: TimeWindow;
  readonly service?: string;
  readonly text?: string;
  readonly problemsOnly?: boolean;
  readonly limit?: number;
};

/** What the model writes to call the tool, read as the tool's input. Only the window is required. */
export const searchLogsInput = z.object({
  window: timeWindowInput.describe("The period to search: a UTC start time and a later UTC end time"),
  service: z.string().min(1).optional().describe("Only the logs of this service, as listed by list_services"),
  text: z.string().min(1).optional().describe("Only the logs whose message contains these words"),
  problemsOnly: z.boolean().optional().describe("true to keep only warnings and errors"),
  limit: z.number().optional().describe("How many message groups to return, from 1 to 50. The default is 10"),
}) satisfies z.ZodType<SearchLogsInput>;


/** The number of message groups to return: a whole number from 1 to 50, and 10 when none is given. */
export function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT);
}

/**
 * Builds the ES|QL query that groups the logs of a window by service and message, most frequent first.
 * It asks for one group more than the limit, to know whether something was cut.
 */
export function buildSearchLogsQuery(input: SearchLogsInput, dataStream: string): string {
  const conditions = [
    toEsqlCondition(input.window),
    ...(input.service === undefined ? [] : [`${FIELDS.serviceName} == ${esqlString(input.service)}`]),
    ...(input.problemsOnly === true
      ? [`TO_UPPER(${FIELDS.severityText}) IN (${PROBLEM_LEVELS.map((level) => esqlString(level)).join(", ")})`]
      : []),
    ...(input.text === undefined ? [] : [`MATCH(${FIELDS.logText}, ${esqlString(input.text)})`]),
  ];
  return [
    `FROM ${dataStream}`,
    `| WHERE ${conditions.join(" AND ")}`,
    `| STATS count = COUNT(*), first_seen = MIN(${FIELDS.timestamp}), last_seen = MAX(${FIELDS.timestamp}) BY service = ${FIELDS.serviceName}, message = ${FIELDS.logText}`,
    "| SORT count DESC, service ASC, message ASC",
    `| LIMIT ${String(normalizeLimit(input.limit) + 1)}`,
  ].join("\n");
}

/** One row of the query result: one message of one service. Service and message are null when the log has none. */
export type SearchLogsRow = {
  readonly service: string | null;
  readonly message: string | null;
  readonly count: number;
  readonly first_seen: string;
  readonly last_seen: string;
};

/** A message and how often, and when, it was logged. */
export type LogPattern = {
  readonly service: string | null;
  readonly message: string | null;
  readonly count: number;
  readonly firstSeen: string;
  readonly lastSeen: string;
};

/** What the tool returns. `truncated` is true when there were more messages than the limit. */
export type SearchLogsOutput = {
  readonly patterns: readonly LogPattern[];
  readonly truncated: boolean;
};

/** Turns the rows into the tool's answer. The query asked for one row more than the limit: that extra row only says something was cut. */
export function parseSearchLogsRows(rows: readonly SearchLogsRow[], limit: number | undefined): SearchLogsOutput {
  const max = normalizeLimit(limit);
  return {
    patterns: rows.slice(0, max).map((row) => ({
      service: row.service,
      message: row.message,
      count: row.count,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    })),
    truncated: rows.length > max,
  };
}

/** The tool: what the services said in a window, grouped by service and message. */
export const searchLogs: Tool<SearchLogsInput, SearchLogsOutput> = {
  name: "search_logs",
  description:
    "Searches the logs of a time window and groups them by service and message, most frequent first. " +
    "Filters: a service, a text, and problemsOnly (warnings and errors). `truncated` is true when more messages exist than the limit.",
  inputSchema: searchLogsInput,
  run: async (input, deps) => {
    const query = buildSearchLogsQuery(input, deps.dataStreams.logs);
    const rows = await runEsql<SearchLogsRow>(deps.client, query);
    return { query, data: parseSearchLogsRows(rows, input.limit) };
  },
};
