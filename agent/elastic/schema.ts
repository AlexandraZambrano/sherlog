// The names of the data streams and fields that Sherlog's queries use, in one place.
// They come from the OpenTelemetry Demo data described in docs/schema.md.
// If the data changes, this is the only file to update.

/** The data streams (the "shelves") where each kind of telemetry lives. */
export const DATA_STREAMS = {
  traces: "traces-generic.otel-default",
  logs: "logs-generic.otel-default",
  metrics: "metrics-*",   // all the metric data streams together: what pattern did we use? (see docs/kibana.md)
} as const;

/** The fields that queries read. */
export const FIELDS = {
  timestamp: "@timestamp",
  serviceName: "resource.attributes.service.name",
  traceId: "trace_id",
  spanId: "span_id",
  parentSpanId: "parent_span_id",
  spanName: "name",
  spanKind: "kind",
  duration: "duration",          // in nanoseconds
  statusCode: "status.code",        // empty, "Ok" or "Error"
  logText: "body.text",           // the text of a log line
} as const;

/** Values that some fields can have. */
export const SPAN_STATUS = { error: "Error" } as const;
export const SPAN_KIND = { server: "Server", client: "Client" } as const;

/** The data stream names a tool reads from. Passed in, so a test can point a tool at its own index. */
export type DataStreamNames = { readonly [Kind in keyof typeof DATA_STREAMS]: string };