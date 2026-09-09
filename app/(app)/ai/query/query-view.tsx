"use client";

import type { AiQueryResult, QueryEntity, QuerySpec } from "@/lib/api/ai";

/**
 * Intelligence Query, laid out to follow legacy's /ai/query.
 *
 * Same shape: a question box with suggestion chips, an advisory note
 * above it, a result table, and — where legacy prints the SQL it
 * generated — what we understood the question to mean.
 *
 * THE SUGGESTIONS ARE NOT LEGACY'S
 *
 * Legacy offers twelve, and most of them ask for things our catalogue
 * deliberately does not expose: crew members with expired medicals,
 * flights per pilot, profit by route, maintenance cost per aircraft.
 * Ours would refuse every one. A chip that reliably produces "I
 * cannot answer that" is worse than no chip — it teaches people the
 * tool is broken.
 *
 * So these are written against the five entities the service
 * actually holds, and the panel underneath lists those entities
 * straight from the API, so what the page claims and what the
 * classifier accepts cannot drift apart.
 *
 * Presentational half, so the layout renders under vitest without a
 * server action in the way.
 */

export interface Turn {
  id: number;
  question: string;
  at: string;
  result?: AiQueryResult;
  error?: string;
}

/** Questions the catalogue can actually answer. */
export const SUGGESTIONS = [
  "How many aircraft do we have?",
  "Which aircraft are grounded?",
  "Show open squawks by severity",
  "How many flights were cancelled in the last 30 days?",
  "Open work orders by priority",
  "Total booking value by destination",
];

/**
 * Which columns hold money, worked out from the spec rather than from
 * the column heading.
 *
 * Money is stored in cents and every such field in the catalogue is
 * named `..._cents`. Printed raw, 1250000 reads as $1.25M rather than
 * the $12,500 it is — the same hundred-fold misreading the executive
 * summary had.
 *
 * Matching on the heading is not enough, and this is not theoretical:
 * asked for booking value by destination the model labelled its sum
 * `total_value` one time and `total_value_cents` another. The label is
 * its choice; the source field is ours, so the aggregate's `field` is
 * what gets read.
 */
function moneyColumns(spec: QuerySpec | null): Set<string> {
  const money = new Set<string>();
  const isCents = (name: string) => name.toLowerCase().endsWith("_cents");

  for (const name of spec?.select ?? []) {
    if (isCents(name)) money.add(name);
  }
  for (const agg of spec?.aggregates ?? []) {
    if (!agg.field || !isCents(agg.field)) continue;
    // A count of a money column is a count, not an amount.
    if (agg.fn === "count") continue;
    money.add(agg.label || `${agg.fn}_${agg.field}`);
  }
  return money;
}

function formatCell(value: unknown, column: string, money: Set<string>): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (money.has(column) || column.toLowerCase().endsWith("_cents")) {
    const cents = Number(value);
    if (Number.isFinite(cents)) {
      const body = `$${(Math.abs(cents) / 100).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })}`;
      return cents < 0 ? `-${body}` : body;
    }
  }
  return String(value);
}

/** A spec read back as a sentence, so it can be checked at a glance
 *  rather than parsed. */
export function describeSpec(spec: QuerySpec): string {
  const parts: string[] = [];
  if (spec.aggregates.length > 0) {
    parts.push(
      spec.aggregates
        .map((a) => (a.field ? `${a.fn} of ${a.field}` : a.fn))
        .join(", "),
    );
  } else if (spec.select.length > 0) {
    parts.push(spec.select.join(", "));
  } else {
    parts.push("everything");
  }
  parts.push(`from ${spec.entity}`);
  if (spec.filters.length > 0) {
    parts.push(
      "where " +
        spec.filters
          .map((f) =>
            f.op === "is_null"
              ? `${f.field} is empty`
              : f.op === "is_not_null"
                ? `${f.field} is set`
                : `${f.field} ${f.op} ${JSON.stringify(f.value)}`,
          )
          .join(" and "),
    );
  }
  if (spec.group_by.length > 0) parts.push(`grouped by ${spec.group_by.join(", ")}`);
  if (spec.order_by) {
    parts.push(`ordered by ${spec.order_by}${spec.order_desc ? " (high to low)" : ""}`);
  }
  return parts.join(" ");
}

export function QueryView({
  turns,
  draft,
  pending,
  entities,
  onDraftChange,
  onAsk,
}: {
  turns: Turn[];
  draft: string;
  pending: boolean;
  entities: QueryEntity[];
  onDraftChange: (value: string) => void;
  onAsk: (question: string) => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Intelligence Query</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ask about your operation in plain English
        </p>
      </header>

      {/* Legacy carries the same warning. Kept, and made specific:
          the numbers come from the operator's own records, and what
          varies is whether the question was read the way they meant
          it. */}
      <p className="mb-5 rounded-lg border border-status-blue/30 bg-status-blue/8 px-3 py-2 text-xs text-status-blue">
        Answers come from your own records, but the question is
        interpreted automatically. Check what it understood before acting
        on anything that matters.
      </p>

      <div className="rounded-xl border border-border bg-card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAsk(draft);
          }}
          className="flex gap-2"
        >
          <label htmlFor="ai-question" className="sr-only">
            Ask a question
          </label>
          <input
            id="ai-question"
            name="question"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            maxLength={500}
            autoComplete="off"
            placeholder="e.g. How many flights were cancelled last month?"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-status-blue focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="rounded-md bg-status-blue px-5 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            {pending ? "Asking…" : "Ask"}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onAsk(s)}
              disabled={pending}
              className="rounded-lg border border-status-blue/20 bg-status-blue/5 px-2.5 py-1 text-[0.65rem] text-status-blue hover:bg-status-blue/12 disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {turns.map((turn) => (
          <TurnBlock key={turn.id} turn={turn} />
        ))}
      </div>

      {entities.length > 0 ? (
        <section
          aria-label="What I can answer about"
          className="mt-6 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            What I can answer about
          </h2>
          {/* Straight from the service, so this and the classifier
              cannot drift apart. */}
          <ul className="space-y-1.5">
            {entities.map((e) => (
              <li key={e.name} className="text-xs">
                <span className="font-semibold">{e.name}</span>
                <span className="text-muted-foreground"> — {e.description}</span>
                <span className="block text-[0.65rem] text-muted-foreground/70">
                  {e.fields.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TurnBlock({ turn }: { turn: Turn }) {
  return (
    <section
      aria-label={`Answer to: ${turn.question}`}
      className="rounded-xl border border-border bg-card"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
        <p className="text-sm font-semibold">{turn.question}</p>
        <span className="text-[0.65rem] text-muted-foreground">{turn.at}</span>
      </header>

      <div className="px-4 py-3">
        {turn.error ? (
          <p role="alert" className="text-sm text-status-red">
            {turn.error}
          </p>
        ) : !turn.result ? (
          <p className="text-sm text-muted-foreground">Working on it…</p>
        ) : turn.result.refusal ? (
          <p className="text-sm text-muted-foreground">{turn.result.refusal}</p>
        ) : turn.result.rows.length === 0 ? (
          // A query that ran and matched nothing is an answer. Saying
          // so beats an empty table, which reads as a failure.
          <p className="text-sm text-muted-foreground">
            Nothing matched that.
          </p>
        ) : (
          <ResultTable result={turn.result} />
        )}

        {turn.result?.spec ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-[0.65rem] text-muted-foreground/70 hover:text-muted-foreground">
              What I understood
            </summary>
            {/* Legacy prints the SQL it generated here. There is no
                SQL to print — the model never writes any — so this is
                the equivalent: the reading the answer came from. */}
            <p className="mt-1.5 rounded-md bg-muted/20 px-3 py-2 font-mono text-[0.65rem] text-muted-foreground">
              {describeSpec(turn.result.spec)}
            </p>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function ResultTable({ result }: { result: AiQueryResult }) {
  const money = moneyColumns(result.spec);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {result.columns.map((col) => (
              <th
                key={col}
                scope="col"
                className="whitespace-nowrap px-2 py-1.5 font-semibold"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {result.columns.map((col) => (
                <td key={col} className="px-2 py-1.5 tabular-nums">
                  {formatCell(row[col], col, money)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[0.65rem] text-muted-foreground">
        {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
