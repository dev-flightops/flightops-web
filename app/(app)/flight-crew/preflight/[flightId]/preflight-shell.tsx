import type {
  CurrentDutyResponse,
  FlightDetail,
  FratAssessmentResponse,
  PilotAcceptanceResponse,
  PreflightProgressResponse,
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
}: Props) {
  const completedNumbers = new Set(progress.completed.map((s) => s.step_number));
  const nextStep = progress.next_step;
  const allDone = nextStep === null;

  return (
    <>
      <FlightContextBar flight={flight} />
      <ProgressIndicator
        completedNumbers={completedNumbers}
        nextStep={nextStep}
        totalSteps={progress.total_steps}
      />

      {allDone ? (
        <AllDonePanel flightId={flight.id} />
      ) : (
        <ActiveStep
          flightId={flight.id}
          flight={flight}
          stepNumber={nextStep}
          duty={duty}
          frat={frat}
          acceptance={acceptance}
        />
      )}

      {progress.completed.length > 0 && (
        <CompletedSummary completed={progress.completed} />
      )}
    </>
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
  totalSteps,
}: {
  completedNumbers: Set<number>;
  nextStep: number | null;
  totalSteps: number;
}) {
  const doneCount = completedNumbers.size;
  const currentStep = nextStep ?? totalSteps;
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-[0.06em]">
          Step {currentStep} of {totalSteps}
        </span>
        <span>{doneCount} complete</span>
      </div>
      {/* Visual progress bar — segmented so the discrete step boundaries are visible. */}
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }, (_, i) => {
          const n = i + 1;
          const isDone = completedNumbers.has(n);
          const isNext = n === nextStep;
          return (
            <span
              key={n}
              aria-label={`Step ${n}${isDone ? " — complete" : isNext ? " — active" : ""}`}
              className={
                isDone
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
}: {
  flightId: string;
  flight: FlightDetail;
  stepNumber: number;
  duty: CurrentDutyResponse;
  frat: FratAssessmentResponse | null;
  acceptance: PilotAcceptanceResponse | null;
}) {
  switch (stepNumber) {
    case 1:
      return <ReviewDispatchReleaseStep flightId={flightId} flight={flight} />;
    case 2:
      return <WeightAndBalanceStep flightId={flightId} flight={flight} />;
    case 3:
      return <WeatherAndNotamStep flightId={flightId} flight={flight} />;
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
}: {
  completed: PreflightProgressResponse["completed"];
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Completed
      </h2>
      <ul className="space-y-1.5">
        {completed.map((s) => (
          <li
            key={s.id}
            className="flex items-baseline justify-between gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs"
          >
            <span className="flex items-baseline gap-2">
              <CheckIcon />
              <span className="font-semibold text-foreground">
                Step {s.step_number}
              </span>
              <span className="text-muted-foreground">{s.label}</span>
            </span>
            <span className="font-mono text-[0.65rem] text-muted-foreground">
              {formatUtcTime(s.completed_at)}
            </span>
          </li>
        ))}
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
