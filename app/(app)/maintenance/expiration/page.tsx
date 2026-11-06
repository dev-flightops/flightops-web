import Link from "next/link";

import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Stat, StatStrip } from "@/components/ff/stat-strip";
import { ApiError } from "@/lib/api/client";
import { getPartExpiration, type Part, type PartExpiration } from "@/lib/api/maintenance";
import { dayLabel, formatQty } from "@/lib/maintenance/parts";
import { cn } from "@/lib/utils";

/**
 * /maintenance/expiration (#172), legacy's expiration_report.html: parts expired,
 * and expiring in the next 90 days, in bands. Today is the company's. Parts with
 * none on hand still show, at zero, as they did there: the row is the batch's
 * record, and it says so.
 */

export const dynamic = "force-dynamic";

function Band({ title, parts, tone }: { title: string; parts: Part[]; tone: string }) {
  if (parts.length === 0) return null;
  return (
    <section aria-label={title} className="mb-5">
      <h2 className={cn("section-title mb-2", tone)}>
        {title} ({parts.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="ff-table w-full text-sm">
          <thead className="ff-thead">
            <tr>
              <th>Part #</th>
              <th>Description</th>
              <th>Batch</th>
              <th>Lot</th>
              <th>Expires</th>
              <th className="text-right">Qty</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr key={part.id}>
                <td className="font-mono text-xs font-semibold">
                  <Link href={`/maintenance/inventory/${part.id}`} className="text-primary hover:underline">
                    {part.part_number}
                  </Link>
                </td>
                <td>{part.description}</td>
                <td className="font-mono text-xs text-muted-foreground">{part.batch_number ?? "—"}</td>
                <td className="font-mono text-xs text-muted-foreground">{part.lot_number ?? "—"}</td>
                <td className={cn("whitespace-nowrap font-semibold", tone)}>{dayLabel(part.expiration_date)}</td>
                <td className="text-right font-mono">{formatQty(part.qty_on_hand)}</td>
                <td className="text-xs text-muted-foreground">{part.location ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function ExpirationPage() {
  let report: PartExpiration | null = null;
  let loadError: string | null = null;
  try {
    report = await getPartExpiration();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "The expiration report is unavailable. Try refreshing in a moment.";
  }
  const empty =
    report &&
    report.expired.length + report.within_30.length + report.within_60.length + report.within_90.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Parts Expiration Report"
        back={{ href: "/maintenance/inventory", label: "Inventory" }}
        description={report ? `Parts expired, and expiring within 90 days of ${dayLabel(report.today)}.` : null}
      />
      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : report ? (
        <>
          <StatStrip label="Parts by when they expire">
            <Stat value={report.expired.length} label="Expired" tone={report.expired.length ? "red" : "neutral"} />
            <Stat value={report.within_30.length} label="Next 30 Days" tone={report.within_30.length ? "yellow" : "neutral"} />
            <Stat value={report.within_60.length} label="31-60 Days" tone="blue" />
            <Stat value={report.within_90.length} label="61-90 Days" tone="green" />
          </StatStrip>
          <Band title="Expired: Do Not Install" parts={report.expired} tone="text-status-red" />
          <Band title="Expiring Within 30 Days" parts={report.within_30} tone="text-status-yellow" />
          <Band title="Expiring 31-60 Days" parts={report.within_60} tone="text-status-blue" />
          <Band title="Expiring 61-90 Days" parts={report.within_90} tone="text-status-green" />
          {empty ? (
            <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-status-green">
              No parts with expiration dates in the next 90 days.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
