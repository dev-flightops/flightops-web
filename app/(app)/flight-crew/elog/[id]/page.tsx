import { notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getFlightLog, listFlightLogLegs } from "@/lib/api/ops";
import { buttonOutline } from "@/components/ff/controls";
import { PageHeader } from "@/components/ff/page-header";
import { FLIGHT_LOG_ADMINS, hasAnyRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { TAB_KEYS, TAB_LABELS, isTabKey, type TabKey } from "./tabs";
import { TabNav } from "./tab-nav";
import { FlightInfoTab } from "./flight-info-tab";
import { AuditTimelinePanel } from "./audit-timeline-panel";
import { LegsTab } from "./legs-tab";
import { LifecycleButtons } from "./lifecycle-buttons";
import { MiscTab } from "./misc-tab";
import { SubmitLogButton } from "./submit-log-button";
import { SummaryTab } from "./summary-tab";
import { TrendsTab } from "./trends-tab";
import { VorTab } from "./vor-tab";
import { WeightBalanceTab } from "./wb-tab";

/**
 * /flight-crew/elog/[id] — the 7-tab Electronic Flight Log detail page
 * (Spec 4 step 4 — shell + Tab 1 + Submit).
 *
 * Layout mirrors legacy `templates/elog/log_page.html`:
 *   1. Flight Info  ← wired up here
 *   2. Legs
 *   3. W&B
 *   4. Flight Summary
 *   5. Trends
 *   6. VOR
 *   7. Misc
 *
 * All seven are built — each has its own component, server actions and
 * tests in this directory. They were marked "← stub" here long after
 * they shipped, which is a docstring telling the next reader six tabs
 * still need writing.
 *
 * Tab state lives in the URL `?tab=info|legs|wb|times|trends|vor|misc`
 * so server-rendered tabs work with Next 16's RSC by default — no
 * client-side state machine, every tab is a Link.
 *
 * MANUAL ENTRY badge renders in the page header when `is_manual_entry`
 * is true, per Spec 4 §"Manual flight log creation".
 *
 * Submit Log button (sticky in header for visibility across tabs)
 * flips draft → submitted; once submitted, the page renders SUBMITTED
 * status and the button is gone.
 */
export default async function FlightLogDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const activeTab: TabKey = isTabKey(tabParam) ? tabParam : "info";

  let log;
  try {
    log = await getFlightLog(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    // Someone else's log (30 Sep): its filer, a Chief Pilot, DO or Exec
    // Admin may open it, as in legacy, whose log page said "Access denied".
    if (err instanceof ApiError && err.status === 403) return <NotYourLog />;
    throw err;
  }

  // A draft is its filing pilot's to change; a Chief Pilot, DO or Exec
  // Admin may correct it (legacy elog's save rule, enforced by the
  // backend since 29 Sep). Reopen and delete stay the filer's alone.
  const session = await auth();
  const isFiler = log.created_by.id === session?.user?.id;
  const canEdit = isFiler || hasAnyRole(session?.roles ?? [], FLIGHT_LOG_ADMINS);

  // Legs power Tabs 2 (editable list), 3 (W&B forms), 4 (Summary
  // roll-ups), and 5 (Trends forms). Fetch when any of them are
  // active; other tabs skip.
  const legs =
    activeTab === "legs" ||
    activeTab === "wb" ||
    activeTab === "times" ||
    activeTab === "trends"
      ? (await listFlightLogLegs(log.id)).items
      : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        back={{ href: "/flight-crew/elog", label: "Flight Log" }}
        eyebrow={
          <span className="flex flex-wrap items-center gap-3">
            <StatusPill status={log.status} />
            {log.is_manual_entry && <ManualEntryBadge />}
          </span>
        }
        title={log.log_number}
        description={
          <>
            <span className="font-mono text-foreground">
              {log.aircraft.tail_number}
            </span>
            {log.aircraft.model ? ` · ${log.aircraft.model}` : ""}
            {" · "}
            {log.flight_date}
            {log.flight_number ? ` · ${log.flight_number}` : ""}
          </>
        }
        actions={
          <>
            {isFiler && (
              <LifecycleButtons
                logId={log.id}
                status={log.status}
                submittedAt={log.submitted_at ?? null}
              />
            )}
            {log.status === "draft" && canEdit && (
              <SubmitLogButton logId={log.id} />
            )}
          </>
        }
      />

      {log.status === "draft" && !canEdit && (
        <p className="notice notice-gray mb-4">
          This is {log.created_by.full_name}&rsquo;s draft. Only they, a Chief
          Pilot, the Director of Operations or an Exec Admin can change it.
        </p>
      )}

      <TabNav activeTab={activeTab} logId={log.id} />

      <div className="mt-5 rounded-lg border border-border bg-card p-5">
        {activeTab === "info" && <FlightInfoTab log={log} canEdit={canEdit} />}
        {activeTab === "legs" && (
          <LegsTab
            logId={log.id}
            logStatus={log.status}
            initialLegs={legs}
            canEdit={canEdit}
          />
        )}
        {activeTab === "wb" && (
          <WeightBalanceTab
            logId={log.id}
            logStatus={log.status}
            initialLegs={legs}
            canEdit={canEdit}
          />
        )}
        {activeTab === "times" && (
          <SummaryTab log={log} legs={legs} canEdit={canEdit} />
        )}
        {activeTab === "trends" && (
          <TrendsTab
            logId={log.id}
            logStatus={log.status}
            airframeType={log.aircraft.airframe_type ?? null}
            initialLegs={legs}
            canEdit={canEdit}
          />
        )}
        {activeTab === "vor" && <VorTab log={log} canEdit={canEdit} />}
        {activeTab === "misc" && <MiscTab log={log} canEdit={canEdit} />}
      </div>

      {/* M2-M-10c — collapsible audit history for the log. Closed by
          default; expands to show the unified audit + CP-review
          timeline. Visible to anyone who can read the log. */}
      <AuditTimelinePanel logId={log.id} />

      {Object.keys(TAB_LABELS).length !== TAB_KEYS.length && (
        // Invariant guard — TAB_KEYS and TAB_LABELS must stay in sync.
        // Render nothing; this only triggers if a future refactor
        // drifts one without the other.
        <noscript />
      )}
    </div>
  );
}

function NotYourLog() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div role="alert" className="notice notice-yellow">
        <span className="notice-label">You can&rsquo;t open this flight log.</span>
        Only the pilot who filed it, a Chief Pilot, the Director of
        Operations or an Exec Admin can.
      </div>
      <Link href="/flight-crew/elog" className={cn(buttonOutline, "mt-4")}>
        ← Flight Log
      </Link>
    </div>
  );
}

function StatusPill({ status }: { status: "draft" | "submitted" }) {
  const isDraft = status === "draft";
  return (
    <span className={isDraft ? "status-mark text-status-yellow" : "status-mark text-status-green"}>
      {isDraft ? "Draft" : "Submitted"}
    </span>
  );
}

function ManualEntryBadge() {
  return (
    <span
      title="Pilot started this log without a dispatch packet (ferry, training, historical entry)."
      className="status-mark text-status-yellow"
    >
      Manual Entry
    </span>
  );
}
