import { ApiError } from "@/lib/api/client";
import { batchWeather } from "@/lib/api/weather";
import type { WeatherReportResponse } from "@/lib/api/types";

import { DisabledPanel, SectionPanel } from "./section-panel";

const MAX_STOPS = 10;

/**
 * Alternate Review panel — M2-G-13.
 *
 * Per ICAO in the routing, surfaces the FAR 91.169 alternate-required
 * verdict (`alternate_required` on the METAR response, M2-M-13 backend):
 *   - true   → "Alternate required" (red strip)
 *   - false  → "No review needed"   (green strip)
 *   - null   → "Unable to determine" (muted)
 *
 * Backend derives the verdict from the *current* METAR (ceiling < 2000 ft
 * OR vis < 3 SM). TAF-based forecast verdicts are a separate problem and
 * not yet covered — there's a one-liner in the footer making that
 * explicit.
 *
 * Self-contained fetch instead of sharing with WeatherPanel — the
 * duplicate batch call hits the weather-service cache (METAR TTL 5 min),
 * so the second one is a sub-millisecond DB lookup, not another AWC hit.
 */
export async function AlternateReviewPanel({ icaos }: { icaos: string[] }) {
  if (icaos.length === 0) {
    return (
      <DisabledPanel
        title="Alternate Review"
        milestone="M2"
        hint="Pick a flight or type a routing above to evaluate whether each airport needs an alternate filed under FAR 91.169."
      />
    );
  }

  // Same dedup + truncation rules as WeatherPanel — keep the two panels
  // consistent so the row count matches.
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const icao of icaos) {
    if (!seen.has(icao)) {
      seen.add(icao);
      uniq.push(icao);
    }
  }
  const stops = uniq.slice(0, MAX_STOPS);

  let batch;
  try {
    batch = await batchWeather(
      stops.map((icao) => ({ icao, kind: "metar" as const })),
    );
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <SectionPanel title="Alternate Review">
        <p className="text-xs italic text-muted-foreground/70">
          Alternate check unavailable ({status || "error"}) — try Refresh
          Weather in a moment.
        </p>
      </SectionPanel>
    );
  }

  const reports = new Map<string, WeatherReportResponse>();
  for (const item of batch.items) {
    reports.set(item.icao, item);
  }

  return (
    <SectionPanel title="Alternate Review">
      <ul className="space-y-1.5">
        {stops.map((icao) => (
          <AlternateRow
            key={icao}
            icao={icao}
            report={reports.get(icao) ?? null}
          />
        ))}
      </ul>
      <p className="mt-3 text-[0.65rem] text-muted-foreground/70">
        Verdict derived from the current METAR (ceiling &lt; 2000 ft OR vis
        &lt; 3 SM, per FAR 91.169). Forecast-based alternate review (TAF
        within ETA ± 1 hr) lands in a later story.
      </p>
    </SectionPanel>
  );
}

type Verdict = "required" | "not_required" | "unknown";

function verdictFor(report: WeatherReportResponse | null): Verdict {
  if (report === null) return "unknown";
  if (report.alternate_required === true) return "required";
  if (report.alternate_required === false) return "not_required";
  return "unknown";
}

function AlternateRow({
  icao,
  report,
}: {
  icao: string;
  report: WeatherReportResponse | null;
}) {
  const verdict = verdictFor(report);
  const styles = {
    required: {
      strip: "border-l-status-red bg-status-red/5",
      label: "text-status-red",
      text: "Alternate required",
    },
    not_required: {
      strip: "border-l-status-green bg-status-green/5",
      label: "text-status-green",
      text: "No review needed",
    },
    unknown: {
      strip: "border-l-muted bg-muted/20",
      label: "text-muted-foreground",
      text: "Unable to determine",
    },
  }[verdict];

  return (
    <li
      className={
        "flex items-start gap-2 rounded-md border border-border border-l-[3px] px-3 py-2 " +
        styles.strip
      }
    >
      <span className="font-mono text-xs font-semibold text-foreground">
        {icao}
      </span>
      <div className="min-w-0 flex-1">
        <p className={"m-0 text-xs font-semibold " + styles.label}>
          {styles.text}
        </p>
        {report && report.flight_category && (
          <p className="m-0 text-[0.65rem] text-muted-foreground">
            METAR: {report.flight_category}
          </p>
        )}
      </div>
    </li>
  );
}
