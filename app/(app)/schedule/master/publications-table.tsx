import Link from "next/link";

import { RemoveRowButton } from "@/components/settings/remove-row-button";
import type { SchedulePublication } from "@/lib/api/master-schedule";
import { localClock, localDate } from "@/lib/format/local-time";

import { withdrawAction } from "./actions";

function day(iso: string): string {
  return localDate(`${iso}T12:00:00Z`, "UTC", { withYear: true });
}

/**
 * What has been published, and what came of it (legacy's Publication History
 * and Published Seasons). A publication can be withdrawn: its flights nobody
 * has worked on come off the schedule, and the record stays here.
 */
export function PublicationsTable({
  publications,
  zone,
  canEdit,
  showSchedule = false,
}: {
  publications: SchedulePublication[];
  /** The company's clock, for when each was published. */
  zone: string;
  canEdit: boolean;
  /** Say which schedule each came from, on the page listing them all. */
  showSchedule?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="ff-thead">
          <tr>
            <th scope="col" className="px-4 py-2 font-semibold">Name</th>
            {showSchedule ? <th scope="col" className="px-4 py-2 font-semibold">Schedule</th> : null}
            <th scope="col" className="px-4 py-2 font-semibold">Dates</th>
            <th scope="col" className="px-4 py-2 font-semibold">Published</th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">Added</th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">Already there</th>
            <th scope="col" className="px-4 py-2 font-semibold">Couldn&rsquo;t add</th>
            <th scope="col" className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {publications.map((p) => (
            <tr key={p.id} className="hover:bg-accent">
              <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
              {showSchedule ? (
                <td className="px-4 py-3">
                  <Link href={`/schedule/master/${p.template_id}`} className="text-foreground hover:underline">
                    {p.template_name}
                  </Link>
                </td>
              ) : null}
              <td className="whitespace-nowrap px-4 py-3">
                {day(p.start_date)} to {day(p.end_date)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {localDate(p.published_at, zone, { withYear: true })} {localClock(p.published_at, zone)}
                {p.published_by ? <div className="text-xs text-muted-foreground">by {p.published_by}</div> : null}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{p.flights_created}</td>
              <td className="px-4 py-3 text-right tabular-nums">{p.flights_already_there}</td>
              <td className="px-4 py-3">
                {p.problem_count === 0 ? (
                  <span className="tabular-nums">0</span>
                ) : (
                  <details>
                    <summary className="cursor-pointer tabular-nums">{p.problem_count}</summary>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {p.problems.map((problem, i) => (
                        <li key={i}>
                          {problem.date} {problem.flight_number}: {problem.message}
                        </li>
                      ))}
                      {p.problem_count > p.problems.length ? (
                        <li>and {p.problem_count - p.problems.length} more</li>
                      ) : null}
                    </ul>
                  </details>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {p.withdrawn_at ? (
                  <span className="text-xs text-muted-foreground">
                    Withdrawn {localDate(p.withdrawn_at, zone)}: {p.flights_removed ?? 0} removed,{" "}
                    {p.flights_created - (p.flights_removed ?? 0)} stayed
                  </span>
                ) : canEdit ? (
                  <RemoveRowButton
                    label={`Withdraw ${p.name}`}
                    word="Withdraw"
                    pendingWord="Withdrawing…"
                    confirm={`Withdraw "${p.name}"? Its ${p.flights_created} flights come off the schedule, except any that have been crewed, booked, released or changed.`}
                    action={withdrawAction.bind(null, p.id, p.template_id)}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
