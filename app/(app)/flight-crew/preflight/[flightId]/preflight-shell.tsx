"use client";

import type { FlightLoad } from "@/lib/api/manifest";
import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { CheckGlyph } from "@/components/ff/glyphs";
import { SquawkDialog } from "@/components/dispatch/packet/squawk-dialog";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { cn } from "@/lib/utils";

import {
  companyCrosswindLimitKt,
  nearLimitEntryKt,
} from "@/lib/frat/company-limits";
import type {
  CurrentDutyResponse,
  FlightDetail,
  FratBlockEligibilityResponse,
  FratPrefillResponse,
  FratThresholdConfigResponse,
  FratAssessmentResponse,
  PilotAcceptanceResponse,
  WeightReturn,
  PreflightProgressResponse,
  WeatherBatchResponse,
} from "@/lib/api/types";

import { ReviewDispatchReleaseStep } from "./step-1-dispatch-release";
import { WeightAndBalanceStep } from "./step-2-weight-balance";
import { WeatherAndNotamStep } from "./step-3-weather-notam";
import { FlightRiskAssessmentStep } from "./step-4-frat";
import { DutyInConfirmStep } from "./step-5-duty";
import { AcceptOrDenyStep } from "./step-6-accept-deny";
import { PositionReportsStep } from "./step-7-position-reports";
import { PostFlightLogStep } from "./step-8-post-flight-log";
import { routeText } from "@/lib/route";

interface Props {
  flight: FlightDetail;
  progress: PreflightProgressResponse;
  duty: CurrentDutyResponse;
  /** Latest FRAT assessment if any — null when no submission yet. */
  frat: FratAssessmentResponse | null;
  /** Latest pilot Accept/Deny if any — null when no submission yet. */
  acceptance: PilotAcceptanceResponse | null;
  weightReturn: WeightReturn | null;
  /** Step 2's weight and balance (#111). Null when it couldn't be read. */
  flightLoad?: FlightLoad | null;
  /** METAR + TAF for the routing airports, fetched server-side. Null
   *  when the weather-service failed — Step 3 falls back to a
   *  "data unavailable" state and still lets the pilot ack that
   *  they reviewed weather in their usual source. */
  weather: WeatherBatchResponse | null;
  /** The operator's own FRAT policy, for the company crosswind limit
   *  the wind factor is scored against. Null when the settings read
   *  failed — the wind factor then says the limit is unavailable and
   *  the pilot scores it by hand, which is what happened before any of
   *  this existed. */
  fratConfig: FratThresholdConfigResponse | null;
  /** Suggested factor scores for step 4, from data the system already
   *  holds. Null when the weather was unreachable or the prefill call
   *  failed — step 4 then renders the questionnaire as it always did,
   *  which is the status quo rather than a regression. */
  fratPrefill: FratPrefillResponse | null;
  /** Whether a FRAT the pilot already filed can be carried to this
   *  leg. Null when the weather was unreachable or the check failed. */
  fratBlock: FratBlockEligibilityResponse | null;
  /** The flight's fuel card, rendered on the server. Below the active
   *  step on every step: the pilot can review and change fuel at any
   *  point in the release process. */
  fuel?: React.ReactNode;
}

/**
 * Spec 4 §"Step header — always visible":
 *
 *   - Flight context bar (flight #, route, aircraft tail, ETD)
 *   - Progress indicator: Step X of 8 + visual progress bar +
 *     green checkmarks for completed steps
 *   - The active step's content area
 *
 * Steps 4–8 land in follow-up PRs; for now they render as a
 * StepStubPanel is the switch's `default:` branch and is unreachable
 * for steps 1-8, every one of which is a real component. It stays as
 * the answer to a step number nobody defined rather than as a
 * "Coming in M2 (follow-up)" stub so the progress indicator
 * remains accurate (next_step still advances correctly).
 */
export function PreflightShell({
  flight,
  progress,
  duty,
  frat,
  acceptance,
  weightReturn,
  flightLoad = null,
  weather,
  fratConfig,
  fratPrefill,
  fratBlock,
  fuel,
}: Props) {
  const completedNumbers = new Set(
    progress.completed.map((s) => s.step_number),
  );
  const nextStep = progress.next_step;
  const allDone = nextStep === null;

  // Review item #6 (Aug 2026) — Edit link on completed steps. When the pilot
  // clicks Edit on step N (already completed), swap the active-step
  // slot to render N's editor instead of `nextStep`. Backend upserts,
  // so submitting from an edit re-writes the row without cascading
  // invalidation.
  const [editingStep, setEditingStep] = useState<number | null>(null);

  // Clear edit state once the server confirms the save. `progress.completed`
  // is fresh on every re-render (server revalidatePath) so the
  // edited step's completed_at timestamp shifts — key the effect on
  // that so we don't get stuck on the editor after a successful save.
  const editedRowKey = editingStep
    ? progress.completed.find((s) => s.step_number === editingStep)
        ?.completed_at
    : null;
  useEffect(() => {
    if (editingStep === null) return;
    // First render after entering edit mode: baseline captured.
    // Subsequent renders where `editedRowKey` changed → save landed.
    // We can't distinguish "just entered edit mode" from "just saved"
    // without a baseline snapshot, so stash the initial value in a
    // ref-like closure via a nested effect. Simplest: track the
    // baseline in state.
  }, [editingStep, editedRowKey]);

  // Ref-in-state baseline pattern: capture completed_at at edit-open,
  // clear editing when it changes.
  const [editBaseline, setEditBaseline] = useState<string | null>(null);
  useEffect(() => {
    if (editingStep === null) {
      setEditBaseline(null);
      return;
    }
    const current =
      progress.completed.find((s) => s.step_number === editingStep)
        ?.completed_at ?? null;
    if (editBaseline === null) {
      setEditBaseline(current);
    } else if (current !== null && current !== editBaseline) {
      // Save landed — exit edit mode.
      setEditingStep(null);
      setEditBaseline(null);
    }
  }, [editingStep, editBaseline, progress.completed]);

  const activeSlotStep = editingStep ?? nextStep;

  return (
    <>
      <FlightContextBar flight={flight} />
      <ProgressIndicator
        completedNumbers={completedNumbers}
        nextStep={nextStep}
        editingStep={editingStep}
        totalSteps={progress.total_steps}
      />

      {editingStep !== null && (
        <EditingBanner
          stepNumber={editingStep}
          onCancel={() => setEditingStep(null)}
        />
      )}

      {editingStep === null && allDone ? (
        <AllDonePanel flight={flight} />
      ) : (
        <ActiveStep
          key={`step-${activeSlotStep}`}
          flightId={flight.id}
          flight={flight}
          stepNumber={activeSlotStep as number}
          duty={duty}
          frat={frat}
          acceptance={acceptance}
          weightReturn={weightReturn}
          flightLoad={flightLoad}
          weather={weather}
          fratConfig={fratConfig}
          fratPrefill={fratPrefill}
          fratBlock={fratBlock}
        />
      )}

      {fuel}

      {progress.completed.length > 0 && (
        <CompletedSummary
          completed={progress.completed}
          editingStep={editingStep}
          onEdit={setEditingStep}
        />
      )}
    </>
  );
}

function EditingBanner({
  stepNumber,
  onCancel,
}: {
  stepNumber: number;
  onCancel: () => void;
}) {
  const label = STEP_LABELS_BY_NUMBER[stepNumber] ?? `Step ${stepNumber}`;
  return (
    <div
      role="status"
      className="notice notice-blue mb-4 flex flex-wrap items-center justify-between gap-2"
    >
      <span>
        <span className="notice-label">Editing Step {stepNumber}</span>
        {label}
      </span>
      <button
        type="button"
        onClick={onCancel}
        className={cn(buttonOutline, "px-2.5 py-1 text-[0.68rem]")}
      >
        Cancel edit
      </button>
    </div>
  );
}

/** The page's head (#81): the flight as the title, its route, aircraft
 *  and ETD under it, and the way back to the crew page. */
function FlightContextBar({ flight }: { flight: FlightDetail }) {
  return (
    <PageHeader
      back={{ href: "/flight-crew", label: "Flight Crew" }}
      eyebrow="Preflight"
      title={flight.flight_number}
      // A defect found on the walk-around or the run-up is squawked
      // against this flight's aircraft, from every step (#92). At a
      // village without an agent, the pilot checks the passengers in
      // (#119).
      actions={
        <>
          <Link href={`/check-in/${flight.id}`} className={buttonOutline}>
            Check in passengers
          </Link>
          <SquawkDialog
            aircraftId={flight.aircraft.id}
            tailNumber={flight.aircraft.tail_number}
          />
        </>
      }
      description={
        <>
          <span className="font-mono font-semibold text-foreground">
            {routeText(flight)}
          </span>
          {" · "}
          {flight.aircraft.tail_number}
          {flight.aircraft.model ? ` · ${flight.aircraft.model}` : ""}
          {" · ETD "}
          <span className="font-mono text-foreground">
            {formatUtcTime(flight.scheduled_departure_at)}
          </span>
        </>
      }
      className="mb-5"
    />
  );
}

function ProgressIndicator({
  completedNumbers,
  nextStep,
  editingStep,
  totalSteps,
}: {
  completedNumbers: Set<number>;
  nextStep: number | null;
  editingStep: number | null;
  totalSteps: number;
}) {
  const doneCount = completedNumbers.size;
  const currentStep = editingStep ?? nextStep ?? totalSteps;
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span className="eyebrow">
          {editingStep !== null ? "Editing step" : "Step"} {currentStep} of{" "}
          {totalSteps}
        </span>
        <span>{doneCount} complete</span>
      </div>
      {/* Visual progress bar — segmented so the discrete step boundaries are visible. */}
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }, (_, i) => {
          const n = i + 1;
          const isDone = completedNumbers.has(n);
          const isNext = n === nextStep;
          const isEditing = n === editingStep;
          return (
            <span
              key={n}
              aria-label={`Step ${n}${isEditing ? " — editing" : isDone ? " — complete" : isNext ? " — active" : ""}`}
              className={
                isEditing
                  ? "h-1 flex-1 bg-primary"
                  : isDone
                    ? "h-1 flex-1 bg-status-green"
                    : isNext
                      ? "h-1 flex-1 bg-primary"
                      : "h-1 flex-1 bg-input"
              }
            />
          );
        })}
      </div>
    </section>
  );
}

function ActiveStep({
  flightId,
  flight,
  stepNumber,
  duty,
  frat,
  acceptance,
  weightReturn,
  flightLoad,
  weather,
  fratConfig,
  fratPrefill,
  fratBlock,
}: {
  flightId: string;
  flight: FlightDetail;
  stepNumber: number;
  duty: CurrentDutyResponse;
  frat: FratAssessmentResponse | null;
  acceptance: PilotAcceptanceResponse | null;
  weightReturn: WeightReturn | null;
  flightLoad: FlightLoad | null;
  weather: WeatherBatchResponse | null;
  fratConfig: FratThresholdConfigResponse | null;
  fratPrefill: FratPrefillResponse | null;
  fratBlock: FratBlockEligibilityResponse | null;
}) {
  switch (stepNumber) {
    case 1:
      return <ReviewDispatchReleaseStep flightId={flightId} flight={flight} />;
    case 2:
      return (
        <WeightAndBalanceStep
          flightId={flightId}
          flight={flight}
          openReturn={weightReturn}
          load={flightLoad}
        />
      );
    case 3:
      return (
        <WeatherAndNotamStep
          flightId={flightId}
          flight={flight}
          weather={weather}
        />
      );
    case 4:
      return (
        <FlightRiskAssessmentStep
          flightId={flightId}
          initial={frat}
          companyCrosswindLimitKt={
            fratConfig
              ? companyCrosswindLimitKt(
                  fratConfig,
                  flight.aircraft.engine_count,
                )
              : null
          }
          nearLimitEntryKt={
            fratConfig
              ? nearLimitEntryKt(fratConfig, flight.aircraft.engine_count)
              : null
          }
          demonstratedCrosswindKt={
            flight.aircraft.max_demonstrated_crosswind_kt
          }
          engineCount={flight.aircraft.engine_count}
          hasCompanyLimits={fratConfig != null}
          fratPrefill={fratPrefill}
          fratBlock={fratBlock}
        />
      );
    case 5:
      return <DutyInConfirmStep flightId={flightId} duty={duty} />;
    case 6:
      return <AcceptOrDenyStep flightId={flightId} initial={acceptance} />;
    case 7:
      return <PositionReportsStep flightId={flightId} flight={flight} />;
    case 8:
      return <PostFlightLogStep flightId={flightId} flight={flight} />;
    default:
      return <StepStubPanel stepNumber={stepNumber} />;
  }
}

const STEP_LABELS_BY_NUMBER: Record<number, string> = {
  1: "Review Dispatch Release",
  2: "Weight and Balance Review",
  3: "Weather and NOTAM Review",
  4: "Flight Risk Assessment Tool (FRAT)",
  5: "Duty In Confirmation",
  6: "Accept or Deny Release",
  7: "Flight Following Position Reports",
  8: "Post-Flight Log",
};

function StepStubPanel({ stepNumber }: { stepNumber: number }) {
  const label = STEP_LABELS_BY_NUMBER[stepNumber] ?? `Step ${stepNumber}`;
  return (
    <section className="rounded-lg border border-border bg-card px-5 py-6">
      <p className="eyebrow">Step {stepNumber}</p>
      <h2 className="panel-title mt-1">{label}</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        This step's UI ships in a follow-up PR. The backend gate accepts a
        completion POST today; for now this surface documents what's coming so
        the progress indicator stays accurate.
      </p>
    </section>
  );
}

function CompletedSummary({
  completed,
  editingStep,
  onEdit,
}: {
  completed: PreflightProgressResponse["completed"];
  editingStep: number | null;
  onEdit: (stepNumber: number) => void;
}) {
  return (
    <Panel title="Completed" flush className="mt-8">
      <ul className="divide-y divide-border">
        {completed.map((s) => {
          const isEditing = editingStep === s.step_number;
          return (
            <li
              key={s.id}
              // The row being edited carries a 3px brand edge, drawn as an
              // inset shadow: a left border here would take the list's
              // divider colour on every row but the first.
              className={
                "flex items-center justify-between gap-2 px-5 py-2.5 text-xs " +
                (isEditing ? "bg-accent/40 shadow-[inset_3px_0_0_rgb(var(--brand-text-rgb))]" : "")
              }
            >
              <span className="flex items-center gap-2">
                <CheckGlyph size={14} className="shrink-0 text-status-green" />
                <span className="font-semibold text-foreground">
                  Step {s.step_number}
                </span>
                <span className="text-muted-foreground">{s.label}</span>
              </span>
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-[0.65rem] text-muted-foreground">
                  {formatUtcTime(s.completed_at)}
                </span>
                {isEditing ? (
                  <span className="status-mark text-primary">Editing…</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onEdit(s.step_number)}
                    disabled={editingStep !== null}
                    className={cn(linkCaps, "disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline")}
                    aria-label={`Edit step ${s.step_number}`}
                  >
                    Edit
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function AllDonePanel({ flight }: { flight: FlightDetail }) {
  const {
    flight_number: flightNumber,
    origin,
    destination,
  } = flight;
  return (
    <section className="rounded-lg border border-border border-l-[3px] border-l-status-green bg-card px-5 py-6">
      <p className="status-mark text-status-green">Preflight complete</p>
      <h2 className="caption-caps mt-2 text-lg text-foreground">All 8 steps complete.</h2>
      <p className="mt-2 text-sm text-foreground">
        Preflight job flow finished for this leg. Position reports + the
        post-flight log are managed from the flight following + electronic
        flight log surfaces once you're airborne / landed.
      </p>
      {/* The flight, not its primary key. This printed the raw UUID at
          a pilot who has just finished a preflight — it identifies
          nothing they recognise and nothing they could read back over a
          radio. The flight number and route are what the leg is called
          everywhere else in the app. */}
      <p className="mt-4 text-xs text-muted-foreground">
        <span className="font-mono font-semibold text-foreground">
          {flightNumber}
        </span>
        {" · "}
        <span className="font-mono">
          {origin} → {destination}
        </span>
      </p>
    </section>
  );
}

function formatUtcTime(iso: string): string {
  return `${iso.slice(11, 16)}Z`;
}
