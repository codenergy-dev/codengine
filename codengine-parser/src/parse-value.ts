// Infer a typed value from a node arg string. Faithful port of the legacy
// yuml-parser parse_value, adapted to JS types.

export function parseValue(raw: string): unknown {
  const value = raw.trim();

  // Quoted string: return the inner text.
  const quoted = /^['"](.*)['"]$/.exec(value);
  if (quoted) return quoted[1];

  const lower = value.toLowerCase();
  if (lower === "true" || lower === "false") return lower === "true";
  if (lower === "none" || lower === "null") return null;

  // Arrays / objects.
  if (value.startsWith("[") || value.startsWith("{")) {
    try {
      return JSON.parse(value);
    } catch {
      // fall through
    }
  }

  // Numbers: integer, then float (mirrors "'.' in value ? float : int").
  if (/^[+-]?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^[+-]?(\d+\.\d*|\.\d+|\d+)$/.test(value) && value.includes(".")) {
    return Number.parseFloat(value);
  }

  // Fallback: the raw string.
  return value;
}
