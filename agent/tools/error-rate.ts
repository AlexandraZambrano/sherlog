import { FIELDS, SPAN_KIND, SPAN_STATUS } from "../elastic/schema";
import { esqlString } from "../elastic/esql-string";
import { toEsqlCondition, type TimeWindow } from "./time-window";
import { runEsql } from "../elastic/run-esql";
import type { Tool } from "./tool";

// The error_rate tool: how often the requests of a service fail, compared with normal.

/** The requests and errors counted in one period, and the error rate they give. */
export type RateSample = {
  readonly requests: number;
  readonly errors: number;
  /**
   * errors divided by requests, as a fraction (0.25 is 25%).
   * null when there were no requests: that is no data, and it is not the same as 0.
   */
  readonly rate: number | null;
};

/** Builds a sample from the counts. With no requests there is no rate, so it is null and not 0 or NaN. */
export function makeRateSample(requests: number, errors: number): RateSample {
  return { requests, errors, rate: requests === 0 ? null : errors / requests  };
}

/** What to ask: the service, the period to look at, and an earlier period that stands for "normal". */
export type ErrorRateInput = {
  readonly service: string;
  readonly window: TimeWindow;
  readonly baseline: TimeWindow;
};

/** True when the two windows share some time. A window that ends exactly when the other starts does not overlap. */
function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  return a.from.getTime() < b.to.getTime() && b.from.getTime() < a.to.getTime();
}

/**
 * Builds the ES|QL query that counts the requests a service received and how many failed,
 * in the window ("current") and in the baseline ("baseline"), with a single query.
 * Throws if the two windows overlap, because a span would then be counted in only one of them.
 */
export function buildErrorRateQuery(input: ErrorRateInput, dataStream: string): string {
  if (overlaps(input.window, input.baseline)) {
    throw new Error(
      `Invalid comparison: the baseline (${input.baseline.from.toISOString()} to ${input.baseline.to.toISOString()}) ` +
        `overlaps the window (${input.window.from.toISOString()} to ${input.window.to.toISOString()}). They must not share any time.`,
    );
  }
  const current = toEsqlCondition(input.window);
  const normal = toEsqlCondition(input.baseline);
  return [
    `FROM ${dataStream}`,
    `| WHERE ${FIELDS.spanKind} == ${esqlString(SPAN_KIND.server)} AND ${FIELDS.serviceName} == ${esqlString(input.service)} AND ((${current}) OR (${normal}))`,
    `| EVAL period = CASE(${current}, "current", "baseline")`,
    `| STATS requests = COUNT(*), errors = COUNT(*) WHERE ${FIELDS.statusCode} == ${esqlString(SPAN_STATUS.error)} BY period`,
  ].join("\n");
}

/** One row of the query result: the counts of one period, labelled "current" or "baseline". */
export type ErrorRateRow = {
  readonly period: string;
  readonly requests: number;
  readonly errors: number;
};

/** What the tool returns to the agent. */
export type ErrorRateOutput = {
  readonly service: string;
  readonly current: RateSample;
  readonly baseline: RateSample;
  /** The current rate minus the baseline rate (0.44 means 44 points more). null if either period has no data. */
  readonly change: number | null;
};

/** The sample of one period. With no row for it there was no data, so it reads as no requests. */
function sampleOf(rows: readonly ErrorRateRow[], period: string): RateSample {
  const row = rows.find((candidate) => candidate.period === period);
  return row === undefined ? makeRateSample(0, 0) : makeRateSample(row.requests, row.errors);
}

/** Turns the rows of the query into the tool's answer. A period without rows has no data, and so has no change. */
export function parseErrorRateRows(rows: readonly ErrorRateRow[], service: string): ErrorRateOutput {
  const current = sampleOf(rows, "current");
  const baseline = sampleOf(rows, "baseline");
  const change = current.rate === null || baseline.rate === null ? null : current.rate - baseline.rate;
  return { service, current, baseline, change };
}

/** The tool: the error rate of a service in a window, compared with a baseline window. */
export const errorRate: Tool<ErrorRateInput, ErrorRateOutput> = {
  name: "error_rate",
  description:
    "Error rate of a service in a time window, compared with an earlier baseline window. " +
    "The rate is null when the service received no requests in that period: that means no data, not 0%.",
  run: async (input, deps) => {
    const query = buildErrorRateQuery(input, deps.dataStreams.traces);
    const rows = await runEsql<ErrorRateRow>(deps.client, query);
    return { query, data: parseErrorRateRows(rows, input.service) };
  },
};