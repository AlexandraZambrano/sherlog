## The OpenTelemetry Demo in Sherlog

The [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo) is a fake
online shop that sells telescopes and other astronomy gear. It is made of about 20 small
services, and Sherlog runs it locally to produce realistic data (logs, metrics and traces)
that the agent can investigate. The demo can also break itself on purpose with feature
flags, which gives us incidents with a known cause. The copied files live in
[`demo/`](../demo/README.md).

### What runs

| Service | What it does in the shop |
|---|---|
| frontend, frontend-proxy | The website, and the front door that routes requests to it |
| product-catalog, astronomy-db | The list of products, and the database that stores them |
| cart, valkey-cart | The shopping cart, and where it keeps its items |
| checkout, payment, shipping, quote, email, currency | The order flow: pay, ship, price the shipping, send the email, convert currency |
| recommendation, ad, image-provider | "You may also like", advertising, and product pictures |
| flagd, flagd-ui | The switches that break things on purpose, and their page |
| load-generator | The fake customers |
| otel-collector | The waiter that carries telemetry |
| telemetry-docs | A small website that documents the custom fields and metrics the shop's services add to their telemetry. Open it at http://localhost:8080/telemetry/ |
| elasticsearch, kibana | Ours: storage and the way to look at the data |
| agent | Ours: the cardboard stub (see #51) |

### What does NOT run, and why

| Left out | Why |
|---|---|
| Kafka layer (kafka, accounting, fraud-detection) | Later, in #49. About 1.1 GB. |
| Jaeger, Prometheus, Grafana, OpenSearch | Elasticsearch and Kibana replace them |
| The demo's AI assistant (agent, mcp, chatbot) | Not needed; a stub stands in |

### Memory

Docker Desktop is set to 12 GB. With everything running, the project uses about 3.6 GB:
Elasticsearch about 1.5 GB (it is capped at 2 GB), Kibana about 0.8 GB, the load generator
about 0.4 GB and the rest of the shop's services a few hundred MB each. The memory limits in
the demo's `compose.yaml` add up to more than what is really used, so 10 GB or more for Docker
is comfortable. Adding the Kafka layer (#49) will need about 1.1 GB more.
