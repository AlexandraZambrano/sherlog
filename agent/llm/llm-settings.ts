// Reads the LLM settings from the environment. The environment is passed in, so tests never touch the real `.env`.
import type { OpenAiCompatibleSettings } from "./openai-compatible-client";

/** The environment as a plain object: the same shape as `process.env`. */
export type Environment = Readonly<Record<string, string | undefined>>;

/** The variables the client needs. A value that is not set, or empty, counts as missing. */
const REQUIRED_VARIABLES = ["LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"] as const;

/** True when the variable has a usable value (`LLM_API_KEY=` with nothing after it does not). */
function isSet(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

/**
 * Builds the client settings from the environment, or fails naming every variable that is missing.
 * Only the names are reported, never the values: the API key must not end up in an error or a log.
 */
export function readLlmSettings(env: Environment): OpenAiCompatibleSettings {
  const { LLM_BASE_URL: baseUrl, LLM_MODEL: model, LLM_API_KEY: apiKey } = env;

  if (isSet(baseUrl) && isSet(model) && isSet(apiKey)) {
    return { baseUrl, apiKey, model };
  }

  const missing = REQUIRED_VARIABLES.filter((name) => !isSet(env[name]));
  throw new Error(`Missing LLM settings in the environment: ${missing.join(", ")}`);
}
