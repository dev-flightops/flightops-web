"use client";

import { useEffect, useState } from "react";

import type {
  CurrentDutyResponse,
  FlightDetail,
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

interface Props {
  flight: FlightDetail;
  progress: PreflightProgressResponse;
  duty: CurrentDutyResponse;
  /** Latest FRAT assessment if any — null when no submission yet. */
  frat: FratAssessmentResponse | null;
  /** Latest pilot Accept/Deny if any — null when no submission yet. */
  acceptance: PilotAcceptanceResponse | null;
  weightReturn: WeightReturn | null;
  /** METAR + TAF for the routing airports, fetched server-side. Null
   *  when the weather-service failed — Step 3 falls back to a
   *  "data unavailable" state and still lets the pilot ack that
   *  they reviewed weather in their usual source. */
  weather: WeatherBatchResponse | null;
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
  weather,
}: Props) {
  const completedNumbers = new Set(progress.completed.map((s) => s.step_number));
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
    ? progress.completed.find((s) => s.step_number === editingStep)?.completed_at
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
    const current = progress.completed.find(
      (s) => s.step_number === editingStep,
    )?.completed_at ?? null;
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
        <AllDonePanel flightId={flight.id} />
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
          weather={weather}
        />
      )}

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
      className="mb-3 flex items-center justify-between gap-2 rounded-md border border-status-blue/40 bg-status-blue/10 px-3 py-2 text-xs"
    >
      <span className="text-status-blue">
        <span className="font-semibold uppercase tracking-[0.06em]">
          Editing Step {stepNumber}
        </span>
        <span className="ml-2 text-foreground/80">{label}</span>
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="rounded border border-border bg-background px-2 py-0.5 text-[0.7rem] font-semibold text-foreground/80 hover:bg-muted/20"
      >
        Cancel edit
      </button>
    </div>
  );
}

function FlightContextBar({ flight }: { flight: FlightDetail }) {
  return (
    <header className="mb-4 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-lg font-bold text-foreground">
          {flight.flight_number}
        </span>
        <span className="font-mono text-sm font-semibold text-foreground">
          {flight.origin} → {flight.destination}
        </span>
        <span className="text-xs text-muted-foreground">
          {flight.aircraft.tail_number}
          {flight.aircraft.model ? ` · ${flight.aircraft.model}` : ""}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          ETD {formatUtcTime(flight.scheduled_departure_at)}
        </span>
      </div>
    </header>
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
        <span className="font-semibold uppercase tracking-[0.06em]">
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
                  ? "h-1.5 flex-1 rounded-full bg-status-blue"
                  : isDone
                    ? "h-1.5 flex-1 rounded-full bg-status-green"
                    : isNext
                      ? "h-1.5 flex-1 rounded-full bg-status-blue"
                      : "h-1.5 flex-1 rounded-full bg-muted-foreground/20"
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
  weather,
}: {
  flightId: string;
  flight: FlightDetail;
  stepNumber: number;
  duty: CurrentDutyResponse;
  frat: FratAssessmentResponse | null;
  acceptance: PilotAcceptanceResponse | null;
  weightReturn: WeightReturn | null;
  weather: WeatherBatchResponse | null;
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
      return <FlightRiskAssessmentStep flightId={flightId} initial={frat} />;
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
    <section className="rounded-xl border border-dashed border-border bg-card/40 px-5 py-8 text-center">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
        Step {stepNumber}
      </p>
      <h2 className="mt-1 text-base font-semibold text-foreground">{label}</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        This step's UI ships in a follow-up PR. The backend gate
        accepts a completion POST today; for now this surface
        documents what's coming so the progress indicator stays
        accurate.
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
    <section className="mt-8">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Completed
      </h2>
      <ul className="space-y-1.5">
        {completed.map((s) => {
          const isEditing = editingStep === s.step_number;
          return (
            <li
              key={s.id}
              className={
                "flex items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-xs " +
                (isEditing
                  ? "border-status-blue/40 bg-status-blue/5"
                  : "border-border bg-card/40")
              }
            >
              <span className="flex items-baseline gap-2">
                <CheckIcon />
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
                  <span className="text-[0.7rem] font-semibold text-status-blue">
                    Editing…
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onEdit(s.step_number)}
                    disabled={editingStep !== null}
                    className="text-[0.7rem] font-semibold text-status-blue hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
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
    </section>
  );
}

function AllDonePanel({ flightId }: { flightId: string }) {
  return (
    <section className="rounded-xl border border-status-green/40 bg-status-green/10 px-5 py-8 text-center">
      <CheckBigIcon />
      <h2 className="mt-2 text-base font-bold text-status-green">
        All 8 steps complete.
      </h2>
      <p className="mt-2 text-sm text-foreground">
        Preflight job flow finished for this leg. Position reports + the
        post-flight log are managed from the flight following + electronic
        flight log surfaces once you're airborne / landed.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">Flight ID {flightId}</p>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 text-status-green"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 8 7 12 13 4" />
    </svg>
  );
}

function CheckBigIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="mx-auto h-10 w-10 text-status-green"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  );
}

function formatUtcTime(iso: string): string {
  return `${iso.slice(11, 16)}Z`;
}
