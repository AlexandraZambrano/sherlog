# Testing

Tests are how this project decides what "correct" means. For the pure parts of the agent's tools, the test is
written **first**. This page explains the three kinds of tests, the test-first cycle (TDD) and the rules we follow.

## Test first (TDD)

TDD means writing the test before the code, in a loop of three steps:

| Step | What you do | What you should see |
|---|---|---|
| **Red** | Write a test for something that does not exist yet | The test fails. Read the message: it must fail for the reason you expect. |
| **Green** | Write the minimum code that makes it pass | The test passes |
| **Refactor** | Clean up names, comments and duplication, without changing behaviour | The tests stay green |

Why it matters here:

- **The test is the written definition of "correct".** It exists before the code, so whoever (or whatever) writes the
  code afterwards has to satisfy it, instead of the test being shaped to fit the code.
- **Seeing it fail proves it can fail.** A test that has never been red might not be able to catch anything.
- **The rules of honesty become tests.** For example "zero requests is *no data*, not a 0% error rate" is written as a
  test before the tool exists, so it cannot be forgotten.

### Where to use it

| Use test first | Test first is not needed |
|---|---|
| Functions that build an ES\|QL query (input to text) | Configuration, Docker, CI |
| Functions that read rows into a short result | Documentation |
| Helpers such as `TimeWindow` | Files that only contain types |
| Any rule with a clear input and output | |

### A real example: `lastMinutes`

1. **Red.** Write the test first, with a fixed date:

   ```ts
   it("starts exactly that many minutes before now", () => {
     const now = new Date("2026-10-14T20:30:00Z");
     expect(lastMinutes(30, now).from).toEqual(new Date("2026-10-14T20:00:00Z"));
   });
   ```

   Run `npm run test:unit`. It fails, because `lastMinutes` does not exist.
2. **Green.** Write the smallest function that makes it pass.
3. **Refactor.** Improve names and comments. Run the tests again.

## The three kinds of tests

| Kind | File name | Command | Needs | Runs in CI |
|---|---|---|---|---|
| **Unit** | `*.test.ts` | `npm run test:unit` | Nothing | Yes |
| **Integration** | `*.integration.test.ts` | `npm run test:integration` | Elasticsearch | Yes (a service container) |
| **Pipeline** | `*.pipeline.test.ts` | `npm run test:pipeline` | The whole stack, with the demo running | No, it runs locally |

`npm test` runs unit and integration tests. The pipeline test checks that telemetry from the demo reaches
Elasticsearch, so it needs `docker compose up -d` first (see [elastic.md](elastic.md)).

CI runs the type check, the linter, the unit tests and the integration tests on every pull request. They must pass
before a pull request can be merged.

## Rules

1. **New behaviour starts with a failing test.** A bug fix starts with a test that reproduces the bug.
2. **Run the test and read the failure before writing the code.**
3. **Use fixed dates written in UTC** (`new Date("2026-10-14T20:30:00Z")`), never the real clock. Functions receive
   `now` as an argument, so a test gives the same result in any time zone.
4. **Split a tool into three parts** so most of it can be tested without Elasticsearch: a pure function that builds the
   query, a pure function that reads the rows, and a thin part that runs the query.
5. **An empty result is not a zero.** Every tool has a test for the case where nothing matched.
6. **Integration tests need no demo data.** CI has an Elasticsearch but not the demo's data, so tests either make up rows
   with the ES|QL `ROW` command or index their own small set of documents and delete them afterwards.
7. **Check that a test can fail.** Break the code on purpose once and read the message.
8. **Do not call a real LLM in tests.** They use a fake OpenAI-compatible server, so CI needs no key and spends no tokens.
