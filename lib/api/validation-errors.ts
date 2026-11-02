/**
 * What a refused request said, for a person.
 *
 * FastAPI answers bad input with a 422 whose `detail` lists each field it
 * refused and why. The forms printed "Backend rejected the request (HTTP
 * 422)", or the raw JSON body, and left the person guessing which field to
 * fix (#134: a customer's email on a reserved domain read that way).
 */

export interface ValidationProblem {
  /** The request field, e.g. "email"; null when the 422 names none. */
  field: string | null;
  message: string;
}

function detailOf(message: string): unknown {
  try {
    return (JSON.parse(message) as { detail?: unknown })?.detail;
  } catch {
    return undefined;
  }
}

/** Pydantic's wording, made a sentence: "value is not a valid email
 *  address: The part after the @-sign is …" → "The part after the @-sign
 *  is …"; "Value error, Pick a date" → "Pick a date". */
function sentence(msg: string): string {
  let text = msg.replace(/^Value error, /, "");
  const colon = text.indexOf(": ");
  if (colon > 0 && /not a valid/.test(text.slice(0, colon))) text = text.slice(colon + 2);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Each field a 422 refused, with why. Empty for anything else. */
export function validationProblems(err: { status: number; message: string }): ValidationProblem[] {
  if (err.status !== 422) return [];
  const detail = detailOf(err.message);
  if (!Array.isArray(detail)) return [];
  return detail.flatMap((d): ValidationProblem[] => {
    if (!d || typeof d !== "object") return [];
    const { loc, msg } = d as { loc?: unknown; msg?: unknown };
    if (typeof msg !== "string" || !msg) return [];
    const path = Array.isArray(loc) ? loc.filter((p): p is string => typeof p === "string" && p !== "body") : [];
    return [{ field: path.at(-1) ?? null, message: sentence(msg) }];
  });
}

function label(field: string): string {
  const words = field.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One line for a form's notice, "Email: The part after the @-sign …", or
 *  null when the refusal wasn't a 422 with fields. */
export function validationSummary(
  err: { status: number; message: string },
  labels: Record<string, string> = {},
): string | null {
  const problems = validationProblems(err);
  if (!problems.length) return null;
  return problems
    .map((p) => (p.field ? `${labels[p.field] ?? label(p.field)}: ${p.message}` : p.message))
    .join(" ");
}

/** A refusal's own words when it has some: a 422's fields, or a detail
 *  code such as "duplicate_email" read as "Duplicate email". Else null. */
export function refusalText(err: { status: number; message: string }): string | null {
  const summary = validationSummary(err);
  if (summary) return summary;
  const detail = detailOf(err.message);
  if (typeof detail === "string" && detail) return label(detail);
  return null;
}
