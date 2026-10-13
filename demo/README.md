# OpenTelemetry Demo files

This folder holds files copied from the [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo),
**version 3.1.0**. The demo is an online shop made of microservices. Sherlog runs it locally
to produce the logs, metrics and traces that the agent investigates.

## License

The copied files are under the **Apache License 2.0**. The license text is in
[`LICENSE`](LICENSE). Sherlog itself is MIT, but our license does not replace the license of
code copied from another project, so the original license and credit travel with the files.

## What was copied

Only the **core** layer of the demo (20 containers). The Kafka layer and the demo's own
observability stack (Jaeger, Prometheus, Grafana, OpenSearch) are not used: Elasticsearch
and Kibana replace the observability stack.

| File | What it is |
|---|---|
| `compose.yaml` | The demo's services |
| `.env` | The demo's default settings |
| `.env.override` | Local overrides, loaded after `.env` |
| `otel-config.yml` | OpenTelemetry settings for the product catalog service: where it sends its logs, metrics and traces |
| `src/flagd/demo.flagd.json` | The feature flags that inject failures |
| `src/postgresql/init.sql` | Creates the database for the shop |
| `src/otel-collector/` | The OpenTelemetry Collector configuration |

## Changes from the original

- `.env.override`: sets `DEMO_VERSION` and `IMAGE_VERSION` to `3.1.0`, so Docker pulls the
  released images and not `latest`. The demo designed this file for local changes.
- Every other file is **unchanged**. When one is changed, it is listed here with the reason.

## Updating to a new demo version

1. Clone the new tag of the demo into a temporary folder.
2. Copy the same files over this folder and review `git diff`.
3. Update the version in `.env.override` and in this file.

## Changes from the original
- `src/otel-collector/otelcol-config-extras.yml`: the demo's file for adding your own exporters.
  It now sends traces, metrics and logs to Elasticsearch, and flushes each batch every 1 second
  (the default is 10 seconds). With 10 seconds, the exporter held data for as long as the demo's
  OpenTelemetry libraries wait before giving up, so most of it was dropped. Everything else in
  the folder is unchanged.
