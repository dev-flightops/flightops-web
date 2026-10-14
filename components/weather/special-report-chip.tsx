import { specialReport } from "@/lib/weather-format";

/**
 * "SPECI 16:59Z" beside a METAR card's age when the latest report is a
 * special one (#71). Other weather sites often show the last routine
 * METAR, so a special report that changes the ceiling reads like a
 * mistake unless the card says what it is.
 */
export function SpecialReportChip({ raw }: { raw: string }) {
  const label = specialReport(raw);
  if (!label) return null;
  return (
    <span
      title="Special report: issued between the hourly METARs because conditions changed"
      className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-status-yellow"
    >
      {label}
    </span>
  );
}
