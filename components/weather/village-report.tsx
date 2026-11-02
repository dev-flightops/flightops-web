import { ReportPhotos } from "@/components/village-wx/report-photos";
import type { VillageBoardRow } from "@/lib/api/types";
import { villageAge, villageCategoryBecause, villageSky, villageStaleness, villageWind } from "@/lib/village-weather-format";
import { utcHm } from "@/lib/weather-format";

/** The village observer's latest report, for a quick reference beside
 *  the METAR (#110), and whether the field has an instrument approach. */
export function VillageReport({ row, now }: { row: VillageBoardRow; now: number }) {
  const r = row.latest_report;
  const noApproach = row.airport.has_instrument_approach === false;
  const reportedAt = r ? new Date(r.reported_at).getTime() : 0;
  const stale = r ? villageStaleness(reportedAt, now) : null;
  const who = r ? (r.reported_by?.full_name ?? r.reported_by_name) : null;
  const because = r ? villageCategoryBecause(r) : null;
  const conditions = r
    ? [
        r.flight_category && because ? `${r.flight_category} (${because})` : r.flight_category,
        villageSky(r),
        villageWind(r),
        r.temperature_c != null ? `${r.temperature_c}°C` : null,
        r.altimeter_in_hg != null ? `${r.altimeter_in_hg.toFixed(2)}"` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <div className="mt-3 border-l-[3px] border-l-status-blue pl-3">
      <p className="eyebrow">Village Report</p>
      {r ? (
        <>
          <p className="mt-1 text-sm font-semibold text-foreground">{conditions || "—"}</p>
          {r.notes ? <p className="text-xs text-foreground">{r.notes}</p> : null}
          <ReportPhotos photos={r.photos} />
          <p
            className={`mt-0.5 text-[0.7rem] ${
              stale === "red"
                ? "text-status-red"
                : stale === "yellow"
                  ? "text-status-yellow"
                  : "text-muted-foreground"
            }`}
          >
            {`${utcHm(r.reported_at)}${who ? ` by ${who}` : ""} · ${villageAge(now - reportedAt)} ago${
              stale === "red" ? " — older than 4 hours" : stale === "yellow" ? " — older than 2 hours" : ""
            }`}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No report from the village yet.</p>
      )}
      {noApproach ? (
        <p className="mt-1 text-[0.7rem] text-muted-foreground">
          No instrument approach: the company&rsquo;s dispatch minimums hold every flight here.
        </p>
      ) : null}
    </div>
  );
}
