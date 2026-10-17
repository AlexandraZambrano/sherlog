// A time window: the frame of time a tool looks at. Always handled in UTC.

/** From one moment (included) to another (excluded). */
export type TimeWindow = {
  readonly from: Date;
  readonly to: Date;
};

/** A window between two moments. Throws if `from` is not before `to`. */
export function between(from: Date, to: Date): TimeWindow {
  // FIX 1: the check that was missing. Windows will come from the agent, which can make mistakes.
  if (from.getTime() >= to.getTime()) {
    throw new Error(
      `Invalid time window: "from" (${from.toISOString()}) must be before "to" (${to.toISOString()}).`,
    );
  }
  return { from, to };
}

/** The last `minutes` minutes before `now`. `now` is passed in so the function stays predictable. */
export function lastMinutes(minutes: number, now: Date): TimeWindow {
  const from = new Date(now.getTime() - minutes * 60_000);   // 60,000 milliseconds in a minute
  return between(from, now);
}

/** The ES|QL condition that keeps only documents inside the window. `from` is included, `to` is not. */
export function toEsqlCondition(window: TimeWindow): string {
  // FIX 2: the parentheses. Without them we write the function itself instead of calling it.
  return `@timestamp >= "${window.from.toISOString()}" AND @timestamp < "${window.to.toISOString()}"`;
}