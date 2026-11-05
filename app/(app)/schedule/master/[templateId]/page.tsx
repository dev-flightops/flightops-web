import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { StatusMark } from "@/components/ff/status-mark";
import { getCompanyProfile, loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getSchedule, type ScheduleDetail } from "@/lib/api/master-schedule";
import { listAircraft } from "@/lib/api/ops";
import type { AircraftListItem } from "@/lib/api/types";
import { localDay } from "@/lib/format/local-time";
import { DISPATCH_WRITERS, hasAnyRole } from "@/lib/roles";
import { nextDay } from "@/lib/schedule/master";

import { PublicationsTable } from "../publications-table";
import { EditSchedule } from "./edit-schedule";
import { PublishForm } from "./publish-form";
import { RoutesPanel } from "./routes-panel";

/**
 * /schedule/master/[templateId] — one schedule: its flights, publishing it to
 * a date range, and what has been published. Legacy
 * `templates/manifest/template_detail.html`.
 */
export default async function ScheduleTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const canEdit = hasAnyRole((await auth())?.roles ?? [], DISPATCH_WRITERS);
  let schedule: ScheduleDetail;
  try {
    schedule = await getSchedule(templateId);
  } catch (err) {
    // A malformed id is a 422 from the API: no such schedule either way.
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <PageHeader back={{ href: "/schedule/master", label: "Master Schedule" }} title="Master Schedule" />
        <Notice tone="red">This schedule couldn&rsquo;t be loaded. Try refreshing in a moment.</Notice>
      </div>
    );
  }
  const zones = await loadZoneTable();
  const [aircraft, groundMinutes] = canEdit
    ? await Promise.all([
        listAircraft()
          .then((list) => list.items.filter((a) => a.is_active))
          .catch((): AircraftListItem[] => []),
        getCompanyProfile()
          .then((company) => company.ground_minutes ?? 15)
          .catch(() => 15),
      ])
    : [[] as AircraftListItem[], 15];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        back={{ href: "/schedule/master", label: "Master Schedule" }}
        eyebrow={<StatusMark label={schedule.is_active ? "Active" : "Inactive"} tone={schedule.is_active ? "green" : "muted"} />}
        title={schedule.name}
        description={schedule.description ?? undefined}
        actions={canEdit ? <EditSchedule key={schedule.name} schedule={schedule} /> : null}
      />
      <div className="space-y-5">
        <RoutesPanel
          templateId={schedule.id}
          routes={schedule.routes}
          aircraft={aircraft}
          zones={zones}
          groundMinutes={groundMinutes}
          canEdit={canEdit}
        />
        {canEdit ? (
          <Panel title="Publish to Date Range">
            {!schedule.is_active ? (
              <p className="text-sm text-muted-foreground">This schedule is inactive. Make it active to publish it.</p>
            ) : schedule.routes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add at least one flight before publishing.</p>
            ) : (
              <PublishForm
                templateId={schedule.id}
                defaultName={schedule.name}
                defaultStart={nextDay(localDay(zones.fallback))}
              />
            )}
          </Panel>
        ) : null}
        <Panel title="Publication History" flush>
          {schedule.publications.length === 0 ? (
            <EmptyState>Not published yet.</EmptyState>
          ) : (
            <PublicationsTable publications={schedule.publications} zone={zones.fallback} canEdit={canEdit} />
          )}
        </Panel>
      </div>
    </div>
  );
}
