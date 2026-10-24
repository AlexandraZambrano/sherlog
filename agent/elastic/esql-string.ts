// Turns any text into a safe ES|QL string literal, so a name coming from outside cannot change the query.

/**
 * Wraps the text in double quotes and escapes what ES|QL treats as special inside a string:
 * backslashes, double quotes and line breaks. Use it for every value that comes from outside
 * (for example a service name chosen by the model) before putting it in a query.
 */
export function esqlString(value: string): string {
  const escaped = value
    .replaceAll("\\", "\\\\")   // 1. backslash first, see the note about the order
    .replaceAll('"', '\\"')     // 2. double quote
    .replaceAll("\n", "\\n")    // 3. line break
    .replaceAll("\r", "\\r")    // 4. carriage return
    .replaceAll("\t", "\\t");   // 5. tab
  return `"${escaped}"`;
}