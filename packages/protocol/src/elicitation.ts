/**
 * An MCP server asks the user for input (elicitation). FORGE treats it as an approval request with this
 * tool name, so prompts, status, notifications, the phone and the audit table work without a second path.
 */
export const ELICITATION_TOOL = "McpElicitation";

export type ElicitationFieldKind = "text" | "number" | "integer" | "boolean" | "select" | "multiselect";

export interface ElicitationField {
  name: string;
  label: string;
  description: string | null;
  kind: ElicitationFieldKind;
  required: boolean;
  options: Array<{ value: string; label: string }>;
  /** as text, the way a field holds it */
  initial: string;
}

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject => !!v && typeof v === "object" && !Array.isArray(v);

/** Options of a JSON schema enum: plain `enum`, or `oneOf`/`anyOf` with `const` and `title`. */
function optionsOf(s: JsonObject): Array<{ value: string; label: string }> {
  if (Array.isArray(s.enum)) {
    const names = Array.isArray(s.enumNames) ? s.enumNames : [];
    return s.enum.map((v, i) => ({ value: String(v), label: typeof names[i] === "string" ? names[i] : String(v) }));
  }
  const list = Array.isArray(s.oneOf) ? s.oneOf : Array.isArray(s.anyOf) ? s.anyOf : [];
  return list.filter(isObject).flatMap((o) => (o.const === undefined ? [] : [{ value: String(o.const), label: typeof o.title === "string" ? o.title : String(o.const) }]));
}

/** The fields of a form elicitation, in the order the server listed them. */
export function elicitationFields(input: Record<string, unknown>): ElicitationField[] {
  const schema = input.schema;
  if (!isObject(schema) || !isObject(schema.properties)) return [];
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((r): r is string => typeof r === "string") : []);
  return Object.entries(schema.properties).flatMap(([name, raw]) => {
    if (!isObject(raw)) return [];
    const type = raw.type;
    const items = isObject(raw.items) ? raw.items : null;
    const options = type === "array" && items ? optionsOf(items) : optionsOf(raw);
    const kind: ElicitationFieldKind = type === "array" ? "multiselect" : options.length ? "select" : type === "boolean" ? "boolean" : type === "integer" ? "integer" : type === "number" ? "number" : "text";
    const fallback = raw.default;
    const initial = Array.isArray(fallback) ? fallback.join("\n") : fallback === undefined || fallback === null ? "" : String(fallback);
    return [
      {
        name,
        label: typeof raw.title === "string" && raw.title ? raw.title : name,
        description: typeof raw.description === "string" && raw.description ? raw.description : null,
        kind,
        required: required.has(name),
        options,
        initial: kind === "boolean" && !initial ? "false" : initial,
      },
    ];
  });
}

export type ElicitationValue = string | number | boolean | string[];

/**
 * The typed answer from the text of each field. Accepts labels as well as values, because the phone
 * passes what the caller said. `invalid` lists fields whose text does not fit, `missing` empty required ones.
 */
export function elicitationContent(fields: ElicitationField[], answers: Record<string, string>): { content: Record<string, ElicitationValue>; missing: string[]; invalid: string[] } {
  const content: Record<string, ElicitationValue> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  const match = (f: ElicitationField, text: string) => {
    const t = text.trim().toLowerCase();
    return f.options.find((o) => o.value.toLowerCase() === t || o.label.toLowerCase() === t)?.value ?? null;
  };
  for (const f of fields) {
    const text = (answers[f.name] ?? "").trim();
    if (!text) {
      if (f.required) missing.push(f.label);
      continue;
    }
    switch (f.kind) {
      case "boolean": {
        const t = text.toLowerCase();
        if (["true", "ja", "yes"].includes(t)) content[f.name] = true;
        else if (["false", "nein", "no"].includes(t)) content[f.name] = false;
        else invalid.push(f.label);
        break;
      }
      case "number":
      case "integer": {
        const n = Number(text.replace(",", "."));
        if (!Number.isFinite(n) || (f.kind === "integer" && !Number.isInteger(n))) invalid.push(f.label);
        else content[f.name] = n;
        break;
      }
      case "select": {
        const v = match(f, text);
        if (v === null) invalid.push(f.label);
        else content[f.name] = v;
        break;
      }
      case "multiselect": {
        // Line breaks from the form; commas only from speech, where an option cannot contain one anyway.
        const parts = (text.includes("\n") ? text.split("\n") : text.split(",")).map((p) => p.trim()).filter(Boolean);
        const values = parts.map((p) => match(f, p));
        if (values.some((v) => v === null)) invalid.push(f.label);
        else content[f.name] = values as string[];
        break;
      }
      default:
        content[f.name] = text;
    }
  }
  return { content, missing, invalid };
}

/** Only web addresses may be opened for a server; anything else could start a program on the computer. */
export function elicitationUrl(url: unknown): string | null {
  return typeof url === "string" && /^https?:\/\/[^\s/?#]+\S*$/i.test(url) ? url : null;
}
