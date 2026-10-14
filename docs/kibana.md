# Exploring the data in Kibana

Kibana is the window onto the data in Elasticsearch. It runs at http://localhost:5601 when the stack is up
(see [Running the stack locally](elastic.md#running-the-stack-locally)). In Sherlog it has one job: let you
**check by hand what the agent claims**. If the agent says "the payment service failed 11 times", you can
run the same query here and see the same number.

## Data views

A **data view** tells Kibana which data streams to read and which field is the clock. Kibana creates
`logs-*` and `metrics-*` by itself. Sherlog adds one more:

| Data view | Index pattern | Time field |
|---|---|---|
| `traces-*` | `traces-*` | `@timestamp` |
| `logs-*` | `logs-*` | `@timestamp` |
| `metrics-*` | `metrics-*` | `@timestamp` |

To create one: **Stack Management, Data Views, Create data view**. The data streams behind them are
described in [schema.md](schema.md).

## Running ES|QL queries in Discover

Open **Discover** (http://localhost:5601/app/discover) and switch it to **ES|QL** mode. In this mode you
type the query itself, with no JSON around it. This is the same language the agent's tools will use.

**Watch out for the time picker.** Discover filters by the time picker at the top **and** by the `WHERE`
in your query, and both must match. If the picker says "Last 15 minutes" and your query asks about
yesterday, you get "0 documents processed". Set the picker to cover the period you ask about.

**Watch out for time zones.** Elasticsearch stores and returns times in **UTC**, while the time picker
uses your browser's zone. In Spain in summer that is two hours ahead: 22:00 on your clock is 20:00 UTC.

## Example queries

The queries below use relative times, so they work whenever you run them. Set the time picker to at least
the period they ask about.

### Traces: which spans failed, and where?

```text
FROM traces-generic.otel-default
| WHERE @timestamp > NOW() - 30 minutes AND status.code == "Error"
| STATS errors = COUNT(*) BY resource.attributes.service.name, name
| SORT errors DESC
```

Counts failed spans per service and operation. When a failure happens deep in the system, it shows up in
**every** service above it, so several rows share the same count. The real origin is the deepest one.

### Logs: what did a service say?

```text
FROM logs-generic.otel-default
| WHERE @timestamp > NOW() - 30 minutes AND resource.attributes.service.name == "payment"
| STATS n = COUNT(*) BY body.text
| SORT n DESC
```

Groups one service's log lines by their text. Look for lines that are rare and sound like an error. During
the payment incident, a line saying `Payment request failed. Invalid token.` appeared once per failed order.
Traces say *where* something broke, logs often say *why*.

### Metrics: is a number moving?

Failed calls per second in the payment service. A counter only goes up, so we ask for its rate with the
`TS` command:

```text
TS metrics-generic.otel-default
| WHERE @timestamp > NOW() - 1 hour
    AND resource.attributes.service.name == "payment"
    AND attributes.span.name == "oteldemo.PaymentService/Charge"
    AND attributes.span.kind == "SPAN_KIND_SERVER"
    AND attributes.status.code == "STATUS_CODE_ERROR"
| STATS failed_per_second = SUM(RATE(metrics.traces.span.metrics.calls)) BY minute = TBUCKET(2 minutes)
| SORT minute
```

It stays at 0 while payments are fine and rises while the `paymentFailure` flag is on.

Memory of each container, which is the evidence for a different kind of incident (a memory leak):

```text
FROM metrics-dockerstatsreceiver.otel-default
| WHERE @timestamp > NOW() - 10 minutes
| STATS mem_mb = ROUND(MAX(metrics.container.memory.usage.total) / 1048576, 0) BY container = resource.attributes.container.name
| SORT mem_mb DESC
```

The division by 1,048,576 turns bytes into megabytes. This metric would not move during the payment
incident, only if a service leaked memory.

## Reading an incident: the order that works

| Step | Look at | Question it answers |
|---|---|---|
| 1 | Metrics | **When** did something change, and how big is it? |
| 2 | Traces | **Where** in the chain did it start? |
| 3 | Logs | **Why**, in words? |

This is also the order the agent follows. Each kind of data is only useful if it measures the thing that
broke, so a metric that looks fine does not mean everything is fine.
