import type { ReactNode } from "react";

import { CheckGlyph } from "@/components/ff/glyphs";
import { cn } from "@/lib/utils";

/**
 * The dispatch packet in the order a dispatcher builds a flight (the
 * client, 24 Nov): "the first piece the dispatcher needs to see is the
 * weather. That dictates what asset can/should be used" and whether it
 * goes VFR or IFR; then the aircraft and pilot; then the weight and
 * balance, "where they can get a load coordinator off and running"; then
 * the FRAT, "just verifying the info they already looked at"; then the
 * release. Every panel the packet had is still here, in its step.
 */

export type StepState = "done" | "attention" | "waiting" | "ready";

export interface PacketStepInfo {
  /** The section's anchor, for the strip's links. */
  id: string;
  n: number;
  title: string;
  state: StepState;
  /** What holds this step, from the release gate, when it needs attention. */
  notes?: string[];
}

const STATE_LABEL: Record<StepState, string> = {
  done: "Done",
  attention: "Needs attention",
  waiting: "Waiting",
  ready: "Ready to release",
};

const MARK_TONE: Record<StepState, string> = {
  done: "border-status-green/50 bg-status-green/10 text-status-green",
  ready: "border-status-green/50 bg-status-green/10 text-status-green",
  attention: "border-status-red/50 bg-status-red/10 text-status-red",
  waiting: "border-border bg-muted text-muted-foreground",
};

const LABEL_TONE: Record<StepState, string> = {
  done: "text-status-green",
  ready: "text-status-green",
  attention: "text-status-red",
  waiting: "text-muted-foreground",
};

function StepMark({ n, state, large = false }: { n: number; state: StepState; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-display font-extrabold tabular-nums",
        large ? "h-8 w-8 text-base" : "h-5 w-5 text-xs",
        MARK_TONE[state],
      )}
    >
      {state === "done" ? <CheckGlyph className={large ? "h-4 w-4" : "h-3 w-3"} /> : n}
    </span>
  );
}

/** The five steps at the top of the packet, each a link to its section. */
export function PacketStepStrip({ steps }: { steps: PacketStepInfo[] }) {
  return (
    <nav aria-label="Dispatch steps" className="rounded-lg border border-border bg-card px-3 py-2">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {steps.map((step, i) => (
          <li key={step.id} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden className="hidden h-px w-4 bg-border sm:block" /> : null}
            <a
              href={`#${step.id}`}
              aria-label={`Step ${step.n}: ${step.title}, ${STATE_LABEL[step.state].toLowerCase()}`}
              className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted"
            >
              <StepMark n={step.n} state={step.state} />
              {step.title}
              {step.state === "attention" && step.notes?.length ? (
                <span className="tabular-nums text-status-red">{step.notes.length}</span>
              ) : null}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** One step of the packet: its number, title and state, what holds it,
 *  and its panels. */
export function PacketStep({
  info,
  summary,
  action,
  children,
}: {
  info: PacketStepInfo;
  /** One line under the title: the step's answer so far. */
  summary?: ReactNode;
  /** A control in the header, e.g. Edit for the rules or the aircraft. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={info.id} aria-labelledby={`${info.id}-title`} data-step={info.n} className="scroll-mt-24 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-3">
          <StepMark n={info.n} state={info.state} large />
          <div className="min-w-0">
            <h2 id={`${info.id}-title`} className="font-display text-base font-extrabold uppercase tracking-wide">
              {info.title}
            </h2>
            {summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("text-xs font-semibold uppercase tracking-wide", LABEL_TONE[info.state])}>
            {STATE_LABEL[info.state]}
          </span>
          {action}
        </div>
      </header>
      {info.state === "attention" && info.notes?.length ? (
        <ul aria-label={`What holds ${info.title.toLowerCase()}`} className="space-y-0.5 text-xs text-status-red">
          {info.notes.map((note, i) => (
            <li key={`${i}:${note}`}>{note}</li>
          ))}
        </ul>
      ) : null}
      {children}
    </section>
  );
}
