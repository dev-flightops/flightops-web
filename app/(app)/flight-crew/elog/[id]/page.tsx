import { notFound } from "next/navigation";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { getFlightLog, listFlightLogLegs } from "@/lib/api/ops";
import { Button } from "@/components/ui/button";

import { TAB_KEYS, TAB_LABELS, isTabKey, type TabKey } from "./tabs";
import { TabNav } from "./tab-nav";
import { FlightInfoTab } from "./flight-info-tab";
import { LegsTab } from "./legs-tab";
import { TabStub } from "./tab-stub";
import { SubmitLogButton } from "./submit-log-button";
import { TrendsTab } from "./trends-tab";
import { VorTab } from "./vor-tab";
import { WeightBalanceTab } from "./wb-tab";

/**
 * /flight-crew/elog/[id] — the 7-tab Electronic Flight Log detail page
 * (Spec 4 step 4 — shell + Tab 1 + Submit).
 *
 * Layout mirrors legacy `templates/elog/log_page.html`:
 *   1. Flight Info  ← wired up here
 *   2. Legs         ← stub
 *   3. W&B          ← stub
 *   4. Flight Summary ← stub
 *   5. Trends       ← stub
 *   6. VOR          ← stub
 *   7. Misc         ← stub
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
    throw err;
  }

  // Legs power Tabs 2 (editable list), 3 (W&B forms), and 5 (Trends
  // forms). Fetch when any of them are active; other tabs skip.
  const legs =
    activeTab === "legs" ||
    activeTab === "wb" ||
    activeTab === "trends"
      ? (await listFlightLogLegs(log.id)).items
      : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              <span className="font-mono">{log.log_number}</span>
            </h1>
            <StatusPill status={log.status} />
            {log.is_manual_entry && <ManualEntryBadge />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono text-status-blue">
              {log.aircraft.tail_number}
            </span>
            {log.aircraft.model ? ` · ${log.aircraft.model}` : ""}
            {" · "}
            {log.flight_date}
            {log.flight_number ? ` · ${log.flight_number}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/flight-crew/elog">← Back</Link>
          </Button>
          {log.status === "draft" && <SubmitLogButton logId={log.id} />}
        </div>
      </header>

      <TabNav activeTab={activeTab} logId={log.id} />

      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        {activeTab === "info" && <FlightInfoTab log={log} />}
        {activeTab === "legs" && (
          <LegsTab
            logId={log.id}
            logStatus={log.status}
            initialLegs={legs}
          />
        )}
        {activeTab === "wb" && (
          <WeightBalanceTab
            logId={log.id}
            logStatus={log.status}
            initialLegs={legs}
          />
        )}
        {activeTab === "times" && (
          <TabStub
            tab="times"
            description="Roll-up of block / flight / hobbs across all legs + the total log summary the dispatcher sees on the history page. Auto-calculated from Tab 2."
          />
        )}
        {activeTab === "trends" && (
          <TrendsTab
            logId={log.id}
            logStatus={log.status}
            airframeType={log.aircraft.airframe_type ?? null}
            initialLegs={legs}
          />
        )}
        {activeTab === "vor" && <VorTab log={log} />}
        {activeTab === "misc" && (
          <TabStub
            tab="misc"
            description="Free-form notes, squawks, and the optional log-page-number reference. Squawks captured here roll into the Maintenance squawks queue."
          />
        )}
      </div>

      {Object.keys(TAB_LABELS).length !== TAB_KEYS.length && (
        // Invariant guard — TAB_KEYS and TAB_LABELS must stay in sync.
        // Render nothing; this only triggers if a future refactor
        // drifts one without the other.
        <noscript />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "draft" | "submitted" }) {
  const isDraft = status === "draft";
  return (
    <span
      className={
        isDraft
          ? "rounded bg-status-yellow/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-status-yellow"
          : "rounded bg-status-green/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-status-green"
      }
    >
      {isDraft ? "Draft" : "Submitted"}
    </span>
  );
}

function ManualEntryBadge() {
  return (
    <span
      title="Pilot started this log without a dispatch packet (ferry, training, historical entry)."
      className="rounded border border-status-yellow/40 bg-status-yellow/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-status-yellow"
    >
      Manual Entry
    </span>
  );
}
