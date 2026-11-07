// Tests for list_services: the pure parts, which need no Elasticsearch.
import { describe, it, expect } from "vitest";
import { between } from "./time-window";
import { buildListServicesQuery, listServicesInput, parseListServicesRows } from "./list-services";

describe("buildListServicesQuery", () => {
  it("counts spans per service inside the window, busiest first", () => {
    const window = between(new Date("2026-10-14T20:00:00Z"), new Date("2026-10-14T20:08:00Z"));

    expect(buildListServicesQuery(window, "traces-x")).toBe(
      [
        "FROM traces-x",
        '| WHERE @timestamp >= "2026-10-14T20:00:00.000Z" AND @timestamp < "2026-10-14T20:08:00.000Z"',
        "| STATS spans = COUNT(*) BY service = resource.attributes.service.name",   // count the spans per service, calling the count `spans` and the service `service`
        "| SORT spans DESC, service ASC",   // busiest service first; when two have the same count, alphabetical by service
      ].join("\n"),
    );
  });
});

describe("parseListServicesRows", () => {
  it("turns each row into a service with its span count, keeping the order", () => {
    const rows = [{ service: "frontend", spans: 30 }, { service: "cart", spans: 5 }];
    expect(parseListServicesRows(rows)).toEqual({ services: [{ name: "frontend", spans: 30 }, { name:"cart", spans: 5 } ]});
  });

  it("ignores rows without a service name, because they cannot be named", () => {
    const rows = [{ service: null, spans: 7 }, { service: "cart", spans: 5 }];
    expect(parseListServicesRows(rows)).toEqual({ services: [{ name:"cart", spans:5 }] });
  });

  it("returns an empty list when no service reported data", () => {
    expect(parseListServicesRows([])).toEqual({services: []});
  });
});

describe("listServicesInput", () => {
  it("reads what the model writes as the input of the tool", () => {
    const input = listServicesInput.parse({ window: { from: "2026-10-14T20:00:00Z", to: "2026-10-14T20:08:00Z" } });

    expect(input).toEqual({ window: { from: new Date("2026-10-14T20:00:00Z"), to: new Date("2026-10-14T20:08:00Z") } });
  });

  it("rejects a call without the window", () => {
    expect(listServicesInput.safeParse({}).success).toBe(false);
  });

  it("points to the exact field that has a bad time", () => {
    const result = listServicesInput.safeParse({ window: { from: "yesterday", to: "2026-10-14T20:00:00Z" } });

    expect(result.success ? [] : result.error.issues[0]?.path).toEqual([ "window", "from" ]);
  });
});
