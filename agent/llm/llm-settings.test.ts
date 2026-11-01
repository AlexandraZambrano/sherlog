// Checks that the LLM settings are read from the environment, and that a missing value is reported by name.
import { describe, it, expect } from "vitest";
import { readLlmSettings } from "./llm-settings";

describe("readLlmSettings", () => {
  it("builds the client settings from the three variables", () => {
    const settings = readLlmSettings({
      LLM_BASE_URL: "https://api.example.com/v1",
      LLM_MODEL: "some-model",
      LLM_API_KEY: "test-key",
    });

    expect(settings).toEqual({
      baseUrl: "https://api.example.com/v1",
      apiKey: "test-key",
      model: "some-model",
    });
  });

  it("names the variable that is missing", () => {
    expect(() => readLlmSettings({ LLM_BASE_URL: "https://api.example.com/v1", LLM_MODEL: "some-model" })).toThrow("LLM_API_KEY");
  });

  it("treats an empty value as missing", () => {
    expect(() =>
      readLlmSettings({ LLM_BASE_URL: "https://api.example.com/v1", LLM_MODEL: "some-model", LLM_API_KEY: "" }),
    ).toThrow("LLM_API_KEY");
  });

  it("names every variable that is missing", () => {
    const readNothing = () => readLlmSettings({});

    expect(readNothing).toThrow("LLM_BASE_URL");
    expect(readNothing).toThrow("LLM_MODEL");
    expect(readNothing).toThrow("LLM_API_KEY");
  });
});
