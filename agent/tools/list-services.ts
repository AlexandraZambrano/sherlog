// The list_services tool: which services reported data in a time window.
import { FIELDS } from "../elastic/schema";
import { toEsqlCondition, type TimeWindow } from "./time-window";
import { runEsql } from "../elastic/run-esql";
import type { Tool } from "./tool";

/** Builds the ES|QL query that counts spans per service inside the window, busiest first. */
export function buildListServicesQuery(window: TimeWindow, dataStream: string): string {
  return [
    `FROM ${dataStream}`,
    `| WHERE ${toEsqlCondition(window)}`,
    `| STATS spans = COUNT(*) BY service = ${FIELDS.serviceName}`,
    "| SORT spans DESC, service ASC",
  ].join("\n");
}

/** One row of the query result. `service` is null for spans that carry no service name. */
export type ListServicesRow = {
  readonly service: string | null;
  readonly spans: number;
};

/** A service that reported data, and how many spans it sent. */
export type ServiceSummary = {
  readonly name: string;
  readonly spans: number;
};

/** What the tool returns to the agent. An empty list means no service reported data. */
export type ListServicesOutput = {
  readonly services: readonly ServiceSummary[];
};

/** Turns the raw rows into the tool's answer. Rows without a service name are ignored: they cannot be named. */
export function parseListServicesRows(rows: readonly ListServicesRow[]): ListServicesOutput {
  return {
    services: rows.flatMap((row) => (row.service === null ? [] : [{ name: row.service, spans: row.spans }])),
  };
}

/** What to ask: which period to look at. */
export type ListServicesInput = { readonly window: TimeWindow };

/** The tool: lists the services that reported spans in a window, busiest first. */
export const listServices: Tool<ListServicesInput, ListServicesOutput> = {
  name: "list_services",
  description: "Lists the services that reported data in a time window, with how many spans each sent.",
  run: async (input, deps) => {
    const query = buildListServicesQuery(input.window, deps.dataStreams.traces);
    const rows = await runEsql<ListServicesRow>(deps.client, query);
    return { query, data: parseListServicesRows(rows) };
  },
};