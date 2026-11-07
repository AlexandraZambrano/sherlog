// Reads the values that the model writes in its tool arguments. The model is outside our control,
// so nothing it sends is trusted until it has been checked here.
import { z } from "zod";
import { between } from "./time-window";

/** A moment written by the model as UTC text, for example "2026-10-14T20:00:00Z", read as a Date. */
export const utcTime = z
  .string()
  .describe("UTC time in ISO 8601 format, for example 2026-10-14T20:00:00Z")
  // The Z is required: without it `new Date` would read the time in the local time zone, and not in UTC.
  .refine((text) => text.endsWith("Z") && !Number.isNaN(Date.parse(text)), {
    message: "Expected a UTC time like 2026-10-14T20:00:00Z",
  })
  .transform((text) => new Date(text));

/** A time window as the model writes it, `{ from, to }` with two UTC times, read as a TimeWindow. */
export const timeWindowInput = z.object({ from: utcTime, to: utcTime }).transform(({ from, to }, context) => {
  // The order is checked here, and not with `between` alone, because `between` throws:
  // the model needs a message that says what to fix. This step only runs when both times are valid.
  if (from.getTime() >= to.getTime()) {
    context.issues.push({ code: "custom", message: "from must be before to", input: { from, to } });
    return z.NEVER;
  }
  return between(from, to);
});
