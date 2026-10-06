import type { DispatchRisk, RiskLevel } from "@/lib/api/dispatch-risk";

import { SectionPanel } from "./section-panel";

/**
 * The dispatch risk matrix (#50), as the client's original packet laid
 * it out: the overall level, the operational concerns, each factor's
 * severity × likelihood, and the plain-English summary. ops scores it;
 * the dispatch page passes the result in.
 */

const LEVEL_TONE: Record<RiskLevel, string> = {
  LOW: "border-status-green/40 bg-status-green/10 text-status-green",
  MEDIUM: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
  HIGH: "border-status-red/40 bg-status-red/10 text-status-red",
};

const ROW_TONE: Record<RiskLevel, string> = {
  LOW: "bg-status-green/10",
  MEDIUM: "bg-status-yellow/10",
  HIGH: "bg-status-red/10",
};

export function RiskAssessmentPanel({
  risk,
  failed = false,
}: {
  risk: DispatchRisk | null;
  /** The flight is picked but scoring didn't answer. */
  failed?: boolean;
}) {
  if (!risk) {
    return (
      <SectionPanel title="Risk Assessment">
        <p className="text-xs text-muted-foreground">
          {failed
            ? "The risk matrix couldn't be scored just now. Try Refresh Weather in a moment."
            : "Pick a flight to score its risk matrix."}
        </p>
      </SectionPanel>
    );
  }
  return (
    <SectionPanel title="Risk Assessment">
      <div
        role="status"
        className={`rounded-md border px-3 py-2 text-sm font-bold ${LEVEL_TONE[risk.level]}`}
      >
        Overall dispatch risk: {risk.level}
        <span className="ml-2 text-xs font-semibold">max score {risk.max_score}</span>
        {risk.management_required && (
          <span className="mt-0.5 block text-xs font-semibold">
            Management approval required
            {risk.inputs.management_approval_obtained ? " — obtained" : " — not yet obtained"}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Operational concerns
      </h3>
      <ul className="mt-1 space-y-0.5 text-xs text-foreground">
        {risk.concerns.map((concern) => (
          <li key={concern}>{concern}</li>
        ))}
      </ul>

      <div className="mt-3 overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-[0.7rem]">
          <caption className="sr-only">
            Risk assessment: severity times likelihood for each factor
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-[0.6rem] uppercase tracking-[0.06em] text-muted-foreground">
              <th scope="col" className="px-2 py-1.5">Risk factor</th>
              <th scope="col" className="px-1.5 py-1.5 text-center">Sev</th>
              <th scope="col" className="px-1.5 py-1.5 text-center">Lik</th>
              <th scope="col" className="px-1.5 py-1.5 text-center">Score</th>
              <th scope="col" className="px-2 py-1.5">Comment</th>
            </tr>
          </thead>
          <tbody>
            {risk.rows.map((row) => {
              const management = row.factor === "Management Approval Flag";
              const outlined = management && risk.management_required;
              return (
                <tr
                  key={row.factor}
                  className={[
                    "border-b border-border last:border-b-0 align-top",
                    row.level ? ROW_TONE[row.level] : "",
                    outlined ? "outline outline-2 -outline-offset-2 outline-status-red" : "",
                  ].join(" ")}
                >
                  <th scope="row" className="px-2 py-1.5 text-left font-semibold">
                    {row.factor}
                  </th>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{row.severity ?? "—"}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{row.likelihood ?? "—"}</td>
                  <td className="px-1.5 py-1.5 text-center font-bold tabular-nums">
                    {row.score ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.comment}
                    {row.source === "dispatcher" && (
                      <span className="ml-1 rounded bg-status-blue/15 px-1 text-[0.6rem] font-semibold text-status-blue">
                        set by dispatcher
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className={`font-bold ${ROW_TONE[risk.level]}`}>
              <th scope="row" className="px-2 py-1.5 text-left">Overall (max)</th>
              <td />
              <td />
              <td className="px-1.5 py-1.5 text-center tabular-nums">{risk.max_score}</td>
              <td className="px-2 py-1.5">{risk.level}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-foreground">
          Risk summary (plain English)
        </summary>
        <p className="mt-1 whitespace-pre-line rounded-md border border-border bg-muted/60 p-2 text-xs text-foreground">
          {risk.summary}
        </p>
      </details>

      <p className="mt-2 text-[0.65rem] text-muted-foreground">
        Score = severity × likelihood (1–5 each). Scored from the route&rsquo;s weather and
        PIREPs, its runways, the company&rsquo;s crosswind limits, the aircraft&rsquo;s MELs and
        100-hour, the manifest and the dispatcher&rsquo;s answers on the left.
      </p>
    </SectionPanel>
  );
}
