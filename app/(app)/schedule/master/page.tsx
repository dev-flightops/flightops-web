import Link from "next/link";

import { auth } from "@/auth";
import { linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { StatusMark } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { listSchedules, type SchedulePublication, type ScheduleSummary } from "@/lib/api/master-schedule";
import { localDate } from "@/lib/format/local-time";
import { DISPATCH_WRITERS, hasAnyRole } from "@/lib/roles";

import { NewSchedule } from "./new-schedule";
import { PublicationsTable } from "./publications-table";

/**
 * /schedule/master — the master schedule (#168), legacy
 * `templates/manifest/template_list.html` and `season_list.html`.
 *
 * The client's day starts from "a master schedule of daily flights": named
 * schedules hold the flights the company flies each week, and publishing one
 * to a date range puts them on the Schedule without building each one.
 */
export default async function MasterSchedulePage() {
  const canEdit = hasAnyRole((await auth())?.roles ?? [], DISPATCH_WRITERS);
  const zones = await loadZoneTable();
  let schedules: ScheduleSummary[] = [];
  let publications: SchedulePublication[] = [];
  let failed = false;
  try {
    ({ items: schedules, publications } = await listSchedules());
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        back={{ href: "/schedule", label: "Schedule" }}
        title="Master Schedule"
        description="The flights you fly every week. Publish a schedule to a date range and they appear on the Schedule, ready to crew and release."
        actions={canEdit ? <NewSchedule /> : null}
      />
      {failed ? (
        <Notice tone="red">The master schedule couldn&rsquo;t be loaded. Try refreshing in a moment.</Notice>
      ) : (
        <div className="space-y-5">
          <Panel title="Schedules" flush>
            {schedules.length === 0 ? (
              <EmptyState>
                {canEdit
                  ? "No schedules yet. Create one, for example Winter 2026, then add the flights you fly each week."
                  : "No schedules yet."}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="ff-thead">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-semibold">Schedule</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Flights</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Last published</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedules.map((schedule) => (
                      <tr key={schedule.id} className="hover:bg-accent">
                        <td className="px-4 py-3">
                          <Link
                            href={`/schedule/master/${schedule.id}`}
                            className="font-semibold text-foreground hover:underline"
                          >
                            {schedule.name}
                          </Link>
                          {schedule.description ? (
                            <div className="text-xs text-muted-foreground">{schedule.description}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{schedule.route_count}</td>
                        <td className="px-4 py-3">
                          {schedule.last_publication ? (
                            <>
                              {schedule.last_publication.name}
                              <div className="text-xs text-muted-foreground">
                                {localDate(schedule.last_publication.published_at, zones.fallback, { withYear: true })},{" "}
                                {schedule.last_publication.flights_created} flights
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Never published</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusMark
                            label={schedule.is_active ? "Active" : "Inactive"}
                            tone={schedule.is_active ? "green" : "muted"}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/schedule/master/${schedule.id}`} className={linkCaps}>
                            Open <span aria-hidden>›</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          {publications.length > 0 ? (
            <Panel title="Published" flush>
              <PublicationsTable publications={publications} zone={zones.fallback} canEdit={canEdit} showSchedule />
            </Panel>
          ) : null}
        </div>
      )}
    </div>
  );
}
