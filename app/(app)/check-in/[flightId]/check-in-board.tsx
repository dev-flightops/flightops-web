"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { Stat, StatStrip } from "@/components/ff/stat-strip";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type {
  CheckInField,
  CheckInInput,
  CheckInPax,
  CheckInView,
  NoShowReason,
} from "@/lib/api/check-in";
import {
  applyStep,
  checkInNeedsForm,
  loadQueue,
  saveQueue,
  stepPaxId,
  type QueuedStep,
} from "@/lib/check-in/offline";
import { cn } from "@/lib/utils";

import {
  addWalkUpAction,
  boardAction,
  checkInAction,
  closeBoardingAction,
  noShowAction,
  openBoardingAction,
  promoteAction,
  refreshAction,
  resetAction,
  type StepResult,
} from "./actions";

/**
 * The check-in itself (#103), legacy's dashboard and its partial
 * (`templates/checkin/partials/state.html`): the counts, planned against
 * actual weight, and every passenger with what can be done to them. Each
 * step answers with the whole check-in, which replaces what is shown.
 *
 * On a phone (#119) the passengers are a list with the next step as one
 * tap beside each name: the client's "quite literally check box next to
 * their names". A step taken without signal is kept on the phone, shown at
 * once, and sent in order when the phone is back (lib/check-in/offline).
 */

const lbs = (v: string | number | null | undefined) =>
  `${Math.round(Number(v ?? 0)).toLocaleString("en-US")} lb`;

const time = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(11, 16) + "Z" : "";

const TICKET_LABEL: Record<string, string> = {
  revenue: "Revenue",
  comp: "Comp",
  employee: "Employee",
  standby: "Standby",
  cargo_only: "Cargo-only",
};

type Dialogs =
  | { kind: "check-in"; pax: CheckInPax }
  | { kind: "no-show"; pax: CheckInPax }
  | { kind: "walk-up" }
  | { kind: "close" }
  | null;

function statusOf(p: CheckInPax): { label: string; tone: StatusTone } {
  if (p.standby) return { label: "Standby", tone: "yellow" };
  switch (p.check_in_status) {
    case "checked_in":
      return { label: "Checked in", tone: "green" };
    case "boarded":
      return { label: "Boarded", tone: "blue" };
    case "no_show":
      return { label: "No-show", tone: "red" };
    default:
      return { label: "Booked", tone: "muted" };
  }
}

/** A step sent to the server: a kept one says when it was taken. */
function send(flightId: string, step: QueuedStep, kept: boolean): Promise<StepResult> {
  const at = kept ? step.at : undefined;
  switch (step.kind) {
    case "check-in":
      return checkInAction(flightId, step.paxId, step.input, at);
    case "board":
      return boardAction(flightId, step.paxId, at);
    case "promote":
      return promoteAction(flightId, step.paxId, at);
    case "reset":
      return resetAction(flightId, step.paxId);
    case "no-show":
      return noShowAction(flightId, step.paxId, step.reason, step.notes, at);
    case "open-boarding":
      return openBoardingAction(flightId, at);
  }
}

const NO_SIGNAL = "No signal on this phone: try again once it's back in service.";

export function CheckInBoard({ initial, canAct }: { initial: CheckInView; canAct: boolean }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [pending, startTransition] = useTransition();
  // Taps kept on the phone until the server has them (#119), whether the
  // last send failed for want of signal, and what the server refused.
  const [kept, setKept] = useState<QueuedStep[]>([]);
  const [stalled, setStalled] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [refused, setRefused] = useState<string[]>([]);
  const [storable, setStorable] = useState(true);
  const keptRef = useRef<QueuedStep[]>([]);
  const sending = useRef(false);
  const flightId = initial.flight_id;

  const closed = view.boarding_closed_at !== null;
  const locked = view.manifest_status === "final";
  // Steps are offered only where the server would take them.
  const open = canAct && view.manifest_id !== null && !closed && !locked;
  const boarding = view.boarding_opened_at !== null && !closed;

  const remember = useCallback(
    (steps: QueuedStep[]) => {
      keptRef.current = steps;
      setKept(steps);
      setStorable(saveQueue(flightId, steps));
    },
    [flightId],
  );

  /** Send what the phone kept, in order, until it runs out of signal.
   *  Only when the phone says it has signal, unless asked to try. */
  const sendKept = useCallback(async (anyway = false) => {
    if (sending.current || keptRef.current.length === 0) return;
    if (!anyway && typeof navigator !== "undefined" && !navigator.onLine) return;
    sending.current = true;
    let anyRefused = false;
    try {
      while (keptRef.current.length > 0) {
        const step = keptRef.current[0];
        let result: StepResult;
        try {
          result = await send(flightId, step, true);
        } catch {
          setStalled(true);
          break; // still no signal; the rest wait
        }
        if (!result.ok && result.retry) {
          // Not a refusal: signed out, or the server couldn't answer. It
          // stays kept, with the rest behind it.
          setError(result.error);
          setStalled(true);
          break;
        }
        setStalled(false);
        // Only this step: a tap made while it was on its way is behind it.
        remember(keptRef.current.filter((kept) => kept !== step));
        if (result.ok) {
          setView(result.view);
        } else {
          anyRefused = true;
          const pax = view.passengers.find((p) => p.id === stepPaxId(step));
          setRefused((prev) => [
            ...prev,
            `${pax ? `${pax.first_name} ${pax.last_name}` : "Boarding"}: ${result.error}`,
          ]);
        }
      }
      if (anyRefused && keptRef.current.length === 0) {
        // What a refused step had shown is undone by the server's own view.
        const fresh = await refreshAction(flightId).catch(() => null);
        if (fresh?.ok) setView(fresh.view);
      }
    } finally {
      sending.current = false;
    }
  }, [flightId, remember, view.passengers]);

  // What a previous visit kept, shown and sent once there's signal; and
  // sent again whenever the phone says it's back, or every 20 s anyway,
  // since a phone can claim signal it doesn't have.
  useEffect(() => {
    const steps = loadQueue(flightId);
    if (steps.length > 0) {
      keptRef.current = steps;
      setKept(steps);
      setView((v) => steps.reduce(applyStep, v));
      void sendKept();
    }
    // Once, on arrival.
  }, [flightId]);
  useEffect(() => {
    const back = () => {
      setOnline(true);
      void sendKept();
    };
    const gone = () => setOnline(false);
    window.addEventListener("online", back);
    window.addEventListener("offline", gone);
    const timer = kept.length > 0 ? window.setInterval(() => void sendKept(), 20_000) : undefined;
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", gone);
      if (timer) window.clearInterval(timer);
    };
  }, [kept.length, sendKept]);

  /** Keep a step on the phone and show it at once. */
  function keep(step: QueuedStep) {
    remember([...keptRef.current, step]);
    setView((v) => applyStep(v, step));
  }

  /** A tap: shown at once and sent behind anything already on its way,
   *  so a slow or missing signal never holds the list up. */
  function tap(step: QueuedStep) {
    setError(null);
    keep(step);
    void sendKept();
  }

  /** A form's step: sent and answered while the form is open, so a
   *  refusal can be put right in it; kept like a tap without signal. */
  function perform(step: QueuedStep, after?: () => void) {
    setError(null);
    if (keptRef.current.length > 0 || (typeof navigator !== "undefined" && !navigator.onLine)) {
      tap(step);
      after?.();
      return;
    }
    startTransition(async () => {
      let result: StepResult;
      try {
        result = await send(flightId, step, false);
      } catch {
        keep(step);
        after?.();
        return;
      }
      if (result.ok) {
        setView(result.view);
        after?.();
      } else {
        setError(result.error);
      }
    });
  }

  /** A step that needs signal: a walk-up, closing boarding. */
  function run(fn: () => Promise<StepResult>, after?: () => void) {
    setError(null);
    if (keptRef.current.length > 0) {
      setError("Send what this phone kept first: it needs signal.");
      return;
    }
    startTransition(async () => {
      let result: StepResult;
      try {
        result = await fn();
      } catch {
        setError(NO_SIGNAL);
        return;
      }
      if (result.ok) {
        setView(result.view);
        after?.();
      } else {
        setError(result.error);
      }
    });
  }

  const now = () => new Date().toISOString();
  const waiting = new Set(kept.map(stepPaxId).filter((id): id is string => id !== null));
  // Kept for want of signal, rather than on their way.
  const noSignal = kept.length > 0 && (stalled || !online);

  const reasonLabel = (code: string | null) =>
    view.no_show_reasons.find((r) => r.code === code)?.label ?? "";

  const planned = Number(view.weights.planned_pax_lbs) + Number(view.weights.planned_bags_lbs);
  const actual = Number(view.weights.actual_pax_lbs) + Number(view.weights.actual_bags_lbs);
  const delta = actual - planned;
  const done = view.counts.checked_in + view.counts.boarded;

  return (
    <div>
      {view.manifest_id === null ? (
        <Notice tone="yellow" label="No manifest yet" className="mb-6">
          Passengers go on the flight&rsquo;s manifest before they can be checked in.{" "}
          <Link href={`/manifest/${view.flight_id}`} className={linkCaps}>
            Open the manifest ›
          </Link>
        </Notice>
      ) : locked ? (
        <Notice tone="green" label="Manifest locked" className="mb-6">
          {closed
            ? `Boarding closed at ${time(view.boarding_closed_at)}; the manifest is final.`
            : "The manifest is final, so the check-in can't change."}
        </Notice>
      ) : closed ? (
        <Notice tone="green" label="Boarding closed" className="mb-6">
          {`Closed at ${time(view.boarding_closed_at)}.`}
        </Notice>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {closed
            ? "Boarding is closed."
            : boarding
              ? `Boarding since ${time(view.boarding_opened_at)}.`
              : "Boarding hasn't begun."}
        </p>
        {open ? (
          <div className="flex flex-wrap gap-2">
            {view.rules.allow_walk_up ? (
              <button type="button" className={buttonOutline} onClick={() => setDialog({ kind: "walk-up" })}>
                + Walk-up
              </button>
            ) : null}
            {boarding ? (
              <button
                type="button"
                className={buttonSolid}
                disabled={pending}
                onClick={() => setDialog({ kind: "close" })}
              >
                Close Boarding
              </button>
            ) : (
              <button
                type="button"
                className={buttonSolid}
                disabled={pending}
                onClick={() => tap({ kind: "open-boarding", at: now() })}
              >
                {pending ? <Spinner size="xs" /> : null}
                Begin Boarding
              </button>
            )}
          </div>
        ) : null}
      </div>

      {noSignal ? (
        <Notice tone="yellow" label="Kept on this phone" role="status" className="mb-6">
          {`${kept.length} ${kept.length === 1 ? "step is" : "steps are"} waiting for signal. They'll be sent in order once the phone is back in service.`}{" "}
          <button type="button" className={linkCaps} onClick={() => void sendKept(true)}>
            Send now ›
          </button>
          {!storable ? (
            <span className="mt-1 block">
              This phone can&rsquo;t store them, so keep the page open until they&rsquo;re sent.
            </span>
          ) : null}
        </Notice>
      ) : null}

      {refused.length > 0 ? (
        <Notice tone="red" label="Not taken when sent" role="alert" className="mb-6">
          <ul className="space-y-0.5">
            {refused.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button type="button" className={cn(linkCaps, "mt-1")} onClick={() => setRefused([])}>
            Dismiss
          </button>
        </Notice>
      ) : null}

      {error && !dialog ? (
        <Notice tone="red" label="Not done" role="alert" className="mb-6">
          {error}
        </Notice>
      ) : null}

      <StatStrip label="Check-in counts">
        <Stat value={view.counts.booked} label="Booked" />
        <Stat value={view.counts.checked_in} label="Checked In" tone="green" />
        <Stat value={view.counts.boarded} label="Boarded" tone="blue" />
        <Stat value={view.counts.no_show} label="No-show" tone="red" />
        <Stat value={view.counts.standby} label="Standby" tone="yellow" />
        <Stat value={`${done} / ${view.counts.total}`} label="Checked In of Total" />
      </StatStrip>

      <StatStrip label="Weights">
        <Stat
          value={lbs(planned)}
          label="Planned"
          hint={`${lbs(view.weights.planned_pax_lbs)} pax + ${lbs(view.weights.planned_bags_lbs)} bags`}
        />
        <Stat
          value={lbs(actual)}
          label="Actual"
          tone="green"
          hint={`${lbs(view.weights.actual_pax_lbs)} pax + ${lbs(view.weights.actual_bags_lbs)} bags`}
        />
        <Stat
          value={`${delta >= 0 ? "+" : "−"}${lbs(Math.abs(delta))}`}
          label="Actual vs Planned"
          tone={Math.abs(delta) > 50 ? "red" : "neutral"}
          hint="Planned counts everyone still expected"
        />
      </StatStrip>

      <section aria-labelledby="pax-heading">
        <h2 id="pax-heading" className="panel-title mb-2">
          Passengers
        </h2>
        {view.passengers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No passengers on this flight&rsquo;s manifest.</p>
        ) : (
          <>
          {/* On a phone: the next step as one tap beside each name (#119). */}
          <ul className="divide-y divide-border rounded-lg border border-border bg-card md:hidden">
            {view.passengers.map((p) => (
              <PhoneRow
                key={p.id}
                pax={p}
                open={open}
                boarding={boarding}
                pending={pending}
                waiting={waiting.has(p.id) ? (noSignal ? "Waiting for signal" : "Sending…") : null}
                reasonLabel={reasonLabel(p.no_show_reason)}
                onCheckIn={() =>
                  checkInNeedsForm(view, p)
                    ? setDialog({ kind: "check-in", pax: p })
                    : tap({
                        kind: "check-in",
                        paxId: p.id,
                        input: { id_verified: p.id_verified, hazmat_declared: null },
                        at: now(),
                      })
                }
                onEdit={() => setDialog({ kind: "check-in", pax: p })}
                onNoShow={() => setDialog({ kind: "no-show", pax: p })}
                onPromote={() => tap({ kind: "promote", paxId: p.id, at: now() })}
                onBoard={() => tap({ kind: "board", paxId: p.id, at: now() })}
                onReset={() => tap({ kind: "reset", paxId: p.id, at: now() })}
              />
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th scope="col" className={TH}>Passenger</th>
                  <th scope="col" className={TH}>Seat</th>
                  <th scope="col" className={TH}>Ticket</th>
                  <th scope="col" className={cn(TH, "text-right")}>
                    Bags
                  </th>
                  <th scope="col" className={cn(TH, "text-right")}>
                    Weight
                  </th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={cn(TH, "text-right")}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {view.passengers.map((p) => {
                  const status = statusOf(p);
                  const weighed = p.planned_weight_lbs !== null && p.planned_weight_lbs !== p.weight_lbs;
                  return (
                    <tr key={p.id} className={cn("hover:bg-accent", p.check_in_status === "no_show" && "opacity-60")}>
                      <td className={TD}>
                        <span className="font-semibold">
                          {p.last_name}, {p.first_name}
                        </span>
                        {p.is_unaccompanied_minor ? (
                          <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-status-yellow">
                            UM
                          </span>
                        ) : null}
                        {p.notes ? <span className="block text-xs text-muted-foreground">{p.notes}</span> : null}
                      </td>
                      <td className={cn(TD, "font-mono text-xs")}>{p.seat_number ?? "—"}</td>
                      <td className={cn(TD, "text-xs capitalize")}>{p.ticket_type.replace("_", " ")}</td>
                      <td className={cn(TD, "text-right font-mono text-xs")}>{p.bags_count ?? "—"}</td>
                      <td className={cn(TD, "whitespace-nowrap text-right font-mono text-xs")}>
                        {lbs(p.weight_lbs)}
                        {weighed ? (
                          <span className="block text-muted-foreground">{`booked ${lbs(p.planned_weight_lbs)}`}</span>
                        ) : null}
                      </td>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        <StatusMark label={status.label} tone={status.tone} />
                        {waiting.has(p.id) ? (
                          <span className="block text-xs text-status-yellow">
                            {noSignal ? "Waiting for signal" : "Sending…"}
                          </span>
                        ) : null}
                        {p.check_in_status === "no_show" ? (
                          <span className="block text-xs text-muted-foreground">{reasonLabel(p.no_show_reason)}</span>
                        ) : p.check_in_status === "boarded" ? (
                          <span className="block text-xs text-muted-foreground">{time(p.boarded_at)}</span>
                        ) : p.check_in_status === "checked_in" && p.checked_in_by_name ? (
                          <span className="block text-xs text-muted-foreground">
                            {`${p.checked_in_by_name}, ${time(p.checked_in_at)}`}
                          </span>
                        ) : null}
                      </td>
                      <td className={cn(TD, "whitespace-nowrap text-right")}>
                        {open ? (
                          <RowActions
                            pax={p}
                            boarding={boarding}
                            pending={pending}
                            onCheckIn={() => setDialog({ kind: "check-in", pax: p })}
                            onNoShow={() => setDialog({ kind: "no-show", pax: p })}
                            onPromote={() => tap({ kind: "promote", paxId: p.id, at: now() })}
                            onBoard={() => tap({ kind: "board", paxId: p.id, at: now() })}
                            onReset={() => tap({ kind: "reset", paxId: p.id, at: now() })}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      {dialog?.kind === "check-in" ? (
        <CheckInDialog
          view={view}
          pax={dialog.pax}
          pending={pending}
          error={error}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
          onSubmit={(input) =>
            perform({ kind: "check-in", paxId: dialog.pax.id, input, at: now() }, () => setDialog(null))
          }
        />
      ) : null}
      {dialog?.kind === "no-show" ? (
        <NoShowDialog
          view={view}
          pax={dialog.pax}
          pending={pending}
          error={error}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
          onSubmit={(reason, notes) =>
            perform({ kind: "no-show", paxId: dialog.pax.id, reason, notes, at: now() }, () =>
              setDialog(null),
            )
          }
        />
      ) : null}
      {dialog?.kind === "walk-up" ? (
        <WalkUpDialog
          pending={pending}
          error={error}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
          onSubmit={(walkUp) => run(() => addWalkUpAction(view.flight_id, walkUp), () => setDialog(null))}
        />
      ) : null}
      {dialog?.kind === "close" ? (
        <CloseBoardingDialog
          view={view}
          pending={pending}
          error={error}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
          onConfirm={() => run(() => closeBoardingAction(view.flight_id), () => setDialog(null))}
        />
      ) : null}
    </div>
  );
}

/** One passenger on a phone (#119): the name, what's on the manifest,
 *  and the next step as a single tap, big enough for a glove. */
function PhoneRow({
  pax,
  open,
  boarding,
  pending,
  waiting,
  reasonLabel,
  onCheckIn,
  onEdit,
  onNoShow,
  onPromote,
  onBoard,
  onReset,
}: {
  pax: CheckInPax;
  open: boolean;
  boarding: boolean;
  pending: boolean;
  /** "Sending…" or "Waiting for signal" while a step of theirs is kept. */
  waiting: string | null;
  reasonLabel: string;
  onCheckIn: () => void;
  onEdit: () => void;
  onNoShow: () => void;
  onPromote: () => void;
  onBoard: () => void;
  onReset: () => void;
}) {
  const status = statusOf(pax);
  const name = `${pax.first_name} ${pax.last_name}`;
  const TAP = "btn-caps min-h-11 min-w-[6.5rem] rounded-md px-3 text-[0.72rem] disabled:opacity-50";
  let primary = null;
  if (open && pax.standby) {
    primary = (
      <button type="button" className={cn(TAP, "border border-input text-foreground")} onClick={onPromote} aria-label={`Seat ${name}`}>
        Seat
      </button>
    );
  } else if (open && pax.check_in_status === "booked") {
    primary = (
      <button type="button" className={cn(TAP, "bg-primary text-primary-foreground")} disabled={pending} onClick={onCheckIn} aria-label={`Check in ${name}`}>
        Check in
      </button>
    );
  } else if (open && pax.check_in_status === "checked_in" && boarding) {
    primary = (
      <button type="button" role="checkbox" aria-checked="false" className={cn(TAP, "border-2 border-primary text-foreground")} onClick={onBoard} aria-label={`Board ${name}`}>
        <span aria-hidden className="mr-1.5 inline-block h-3.5 w-3.5 border-2 border-current align-[-2px]" />
        Board
      </button>
    );
  } else if (pax.check_in_status === "boarded") {
    primary = (
      <span role="checkbox" aria-checked="true" aria-label={`${name} on board`} className={cn(TAP, "inline-flex items-center justify-center bg-status-blue-fill text-white")}>
        <span aria-hidden className="mr-1.5">✓</span>
        On board
      </span>
    );
  }
  return (
    <li className={cn("flex items-center gap-3 px-3 py-3", pax.check_in_status === "no_show" && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {pax.last_name}, {pax.first_name}
          {pax.is_unaccompanied_minor ? (
            <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-status-yellow">UM</span>
          ) : null}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {[pax.seat_number ? `Seat ${pax.seat_number}` : null, lbs(pax.weight_lbs), `${pax.bags_count ?? "—"} bags`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <StatusMark label={status.label} tone={status.tone} />
          {pax.check_in_status === "no_show" && reasonLabel ? (
            <span className="text-xs text-muted-foreground">{reasonLabel}</span>
          ) : null}
          {waiting ? <span className="text-xs text-status-yellow">{waiting}</span> : null}
        </p>
        {open ? (
          <p className="mt-1 flex flex-wrap gap-x-4">
            {pax.check_in_status === "checked_in" ? (
              <button type="button" className={ACTION} disabled={pending} onClick={onEdit} aria-label={`Edit ${name}`}>
                Edit
              </button>
            ) : null}
            {pax.check_in_status === "booked" ? (
              <button type="button" className={cn(ACTION, "text-status-red")} disabled={pending} onClick={onNoShow} aria-label={`No-show ${name}`}>
                No-show
              </button>
            ) : null}
            {pax.check_in_status === "checked_in" || pax.check_in_status === "no_show" ? (
              <button type="button" className={cn(ACTION, "text-muted-foreground")} disabled={pending} onClick={onReset} aria-label={`Undo ${name}`}>
                Undo
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
      {primary}
    </li>
  );
}

const TH = "px-3 py-2.5";
const TD = "px-3 py-2.5 align-top";

const ACTION = "text-[0.68rem] font-bold uppercase tracking-[0.1em] hover:underline underline-offset-4 disabled:opacity-50";

function RowActions({
  pax,
  boarding,
  pending,
  onCheckIn,
  onNoShow,
  onPromote,
  onBoard,
  onReset,
}: {
  pax: CheckInPax;
  boarding: boolean;
  pending: boolean;
  onCheckIn: () => void;
  onNoShow: () => void;
  onPromote: () => void;
  onBoard: () => void;
  onReset: () => void;
}) {
  const name = `${pax.first_name} ${pax.last_name}`;
  return (
    <span className="inline-flex items-center gap-3">
      {pax.standby ? (
        <button type="button" className={cn(ACTION, "text-primary")} disabled={pending} onClick={onPromote} aria-label={`Promote ${name}`}>
          Promote
        </button>
      ) : null}
      {pax.check_in_status === "booked" && !pax.standby ? (
        <button type="button" className={cn(ACTION, "text-primary")} disabled={pending} onClick={onCheckIn} aria-label={`Check in ${name}`}>
          Check In
        </button>
      ) : null}
      {pax.check_in_status === "checked_in" ? (
        <>
          {boarding ? (
            <button type="button" className={cn(ACTION, "text-primary")} onClick={onBoard} aria-label={`Board ${name}`}>
              Board
            </button>
          ) : null}
          <button type="button" className={ACTION} disabled={pending} onClick={onCheckIn} aria-label={`Edit ${name}`}>
            Edit
          </button>
        </>
      ) : null}
      {pax.check_in_status === "booked" ? (
        <button type="button" className={cn(ACTION, "text-status-red")} disabled={pending} onClick={onNoShow} aria-label={`No-show ${name}`}>
          No-show
        </button>
      ) : null}
      {pax.check_in_status === "checked_in" || pax.check_in_status === "no_show" ? (
        <button type="button" className={cn(ACTION, "text-muted-foreground")} disabled={pending} onClick={onReset} aria-label={`Undo ${name}`}>
          Undo
        </button>
      ) : null}
    </span>
  );
}

function Required({ when }: { when: boolean }) {
  return when ? (
    <span className="text-status-red" aria-hidden>
      {" *"}
    </span>
  ) : null;
}

const INPUT = "ff-input px-3 py-2 text-sm";

function num(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function CheckInDialog({
  view,
  pax,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  view: CheckInView;
  pax: CheckInPax;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: CheckInInput) => void;
}) {
  const rules = view.rules;
  const editing = pax.check_in_status === "checked_in";
  // A booked passenger has not been asked yet, so nothing is chosen: legacy
  // ticked "No hazmat" for them, which answered the question for the agent.
  const [hazmat, setHazmat] = useState<boolean | null>(editing ? pax.hazmat_declared : null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const custom: Record<string, string | number | boolean> = {};
    for (const f of view.fields) {
      const raw = form.get(`cf_${f.field_key}`);
      if (f.field_type === "checkbox") {
        if (raw) custom[f.field_key] = true;
      } else if (raw !== null && String(raw).trim() !== "") {
        custom[f.field_key] = f.field_type === "number" ? Number(raw) : String(raw);
      }
    }
    onSubmit({
      first_name: String(form.get("first_name") ?? "").trim() || undefined,
      last_name: String(form.get("last_name") ?? "").trim() || undefined,
      actual_weight_lbs: num(form.get("actual_weight_lbs")),
      actual_baggage_lbs: num(form.get("actual_baggage_lbs")),
      bags_count: num(form.get("bags_count")),
      seat_number: String(form.get("seat_number") ?? "").trim() || null,
      id_verified: form.get("id_verified") === "yes",
      hazmat_declared: hazmat,
      hazmat_notes: String(form.get("hazmat_notes") ?? "").trim() || null,
      custom_fields: custom,
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{`${editing ? "Edit Check-in" : "Check In"}: ${pax.first_name} ${pax.last_name}`}</DialogTitle>
          <DialogDescription>
            {`${TICKET_LABEL[pax.ticket_type] ?? pax.ticket_type} ticket, booked at ${lbs(pax.planned_weight_lbs ?? pax.weight_lbs)} with ${lbs(pax.planned_baggage_lbs ?? pax.baggage_lbs)} of bags.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">First Name</span>
              <input name="first_name" defaultValue={pax.first_name} maxLength={80} className={INPUT} />
            </label>
            <label className="block">
              <span className="field-label">Last Name</span>
              <input name="last_name" defaultValue={pax.last_name} maxLength={80} className={INPUT} />
            </label>
            <label className="block">
              <span className="field-label">
                Actual Weight (lb)
                <Required when={rules.require_actual_weight} />
              </span>
              <input
                name="actual_weight_lbs"
                type="number"
                min={0}
                max={1000}
                step="0.1"
                defaultValue={Number(pax.weight_lbs) || undefined}
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className="field-label">
                Seat
                <Required when={rules.require_seat_assignment} />
              </span>
              <input
                name="seat_number"
                defaultValue={pax.seat_number ?? ""}
                maxLength={10}
                placeholder="2A"
                className={cn(INPUT, "font-mono uppercase")}
              />
            </label>
            <label className="block">
              <span className="field-label">
                Bags
                <Required when={rules.require_bags_count} />
              </span>
              <input
                name="bags_count"
                type="number"
                min={0}
                max={50}
                defaultValue={pax.bags_count ?? undefined}
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className="field-label">
                Actual Bag Weight (lb)
                <Required when={rules.require_actual_bag_weight} />
              </span>
              <input
                name="actual_baggage_lbs"
                type="number"
                min={0}
                max={2000}
                step="0.1"
                defaultValue={Number(pax.baggage_lbs) || undefined}
                className={INPUT}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="id_verified" value="yes" defaultChecked={pax.id_verified} />
            <span>
              Government ID verified
              <Required when={rules.require_id_verification} />
            </span>
          </label>

          <fieldset>
            <legend className="field-label">
              Hazmat Declaration
              <Required when={rules.require_hazmat_declaration} />
            </legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="hazmat" checked={hazmat === false} onChange={() => setHazmat(false)} />
                No hazmat
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="hazmat" checked={hazmat === true} onChange={() => setHazmat(true)} />
                Hazmat declared
              </label>
            </div>
            {hazmat ? (
              <input
                name="hazmat_notes"
                defaultValue={pax.hazmat_notes ?? ""}
                maxLength={1000}
                placeholder="What, and how it is packed"
                className={cn(INPUT, "mt-2")}
              />
            ) : null}
          </fieldset>

          {view.fields.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {view.fields.map((f) => (
                <CustomFieldInput key={f.field_key} field={f} value={pax.custom_fields[f.field_key]} />
              ))}
            </div>
          ) : null}

          {error ? (
            <Notice tone="red" label="Not checked in" role="alert">
              {error}
            </Notice>
          ) : null}

          <DialogFooter className="gap-2">
            <button type="button" className={buttonOutline} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={buttonSolid} disabled={pending}>
              {pending ? <Spinner size="xs" /> : null}
              {editing ? "Save Changes" : "Check In Passenger"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomFieldInput({
  field,
  value,
}: {
  field: CheckInField;
  value: string | number | boolean | undefined;
}) {
  const name = `cf_${field.field_key}`;
  const label = (
    <span className="field-label">
      {field.field_label}
      <Required when={field.is_required} />
    </span>
  );
  const help = field.help_text ? <span className="mt-1 block text-xs text-muted-foreground">{field.help_text}</span> : null;
  if (field.field_type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name={name} value="yes" defaultChecked={value === true} />
        <span>
          {field.field_label}
          <Required when={field.is_required} />
        </span>
      </label>
    );
  }
  if (field.field_type === "dropdown") {
    return (
      <label className="block">
        {label}
        <select name={name} defaultValue={value === undefined ? "" : String(value)} className={INPUT}>
          <option value="">Select</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {help}
      </label>
    );
  }
  return (
    <label className="block">
      {label}
      <input
        name={name}
        type={field.field_type === "number" ? "number" : "text"}
        step={field.field_type === "number" ? "any" : undefined}
        maxLength={field.field_type === "number" ? undefined : 200}
        defaultValue={value === undefined ? "" : String(value)}
        className={INPUT}
      />
      {help}
    </label>
  );
}

function NoShowDialog({
  view,
  pax,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  view: CheckInView;
  pax: CheckInPax;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (reason: NoShowReason, notes: string | null) => void;
}) {
  // A standby passenger left without a seat is recorded when boarding closes.
  const reasons = view.no_show_reasons.filter((r) => r.code !== "standby_no_seat" || pax.standby);
  const bags = (pax.bags_count ?? 0) > 0 || Number(pax.baggage_lbs) > 0;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit(form.get("reason") as NoShowReason, String(form.get("notes") ?? "").trim() || null);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{`No-show: ${pax.first_name} ${pax.last_name}`}</DialogTitle>
          <DialogDescription>
            They come off weight and balance and the passenger counts. Undo puts them back.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="field-label">Reason</span>
            <select name="reason" required defaultValue={reasons[0]?.code} className={INPUT}>
              {reasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Notes</span>
            <textarea name="notes" rows={3} maxLength={1000} className={INPUT} />
          </label>
          {view.rules.no_show_fee ? (
            <Notice tone="yellow" label="Fee">
              {`A no-show fee of $${Number(view.rules.no_show_fee).toFixed(2)} is recorded, per company policy.`}
            </Notice>
          ) : null}
          {bags ? (
            <Notice tone="red" label="Bags" role="status">
              They had bags. Make sure the ramp takes them off.
            </Notice>
          ) : null}
          {error ? (
            <Notice tone="red" label="Not done" role="alert">
              {error}
            </Notice>
          ) : null}
          <DialogFooter className="gap-2">
            <button type="button" className={buttonOutline} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={buttonSolid} disabled={pending}>
              {pending ? <Spinner size="xs" /> : null}
              Confirm No-show
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WalkUpDialog({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (walkUp: { first_name: string; last_name: string; weight_lbs: number; baggage_lbs: number }) => void;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit({
      first_name: String(form.get("first_name") ?? "").trim(),
      last_name: String(form.get("last_name") ?? "").trim(),
      weight_lbs: num(form.get("weight_lbs")) ?? 0,
      baggage_lbs: num(form.get("baggage_lbs")) ?? 0,
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Walk-up</DialogTitle>
          <DialogDescription>
            Adds them to the manifest as booked; then check them in as anyone else.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">First Name</span>
              <input name="first_name" required maxLength={80} className={INPUT} />
            </label>
            <label className="block">
              <span className="field-label">Last Name</span>
              <input name="last_name" required maxLength={80} className={INPUT} />
            </label>
            <label className="block">
              <span className="field-label">Weight (lb)</span>
              <input name="weight_lbs" type="number" min={0} max={1000} step="0.1" required className={INPUT} />
            </label>
            <label className="block">
              <span className="field-label">Bags (lb)</span>
              <input name="baggage_lbs" type="number" min={0} max={2000} step="0.1" defaultValue={0} className={INPUT} />
            </label>
          </div>
          {error ? (
            <Notice tone="red" label="Not added" role="alert">
              {error}
            </Notice>
          ) : null}
          <DialogFooter className="gap-2">
            <button type="button" className={buttonOutline} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={buttonSolid} disabled={pending}>
              {pending ? <Spinner size="xs" /> : null}
              Add Walk-up
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseBoardingDialog({
  view,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  view: CheckInView;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const waiting = view.passengers.filter((p) => p.standby).length;
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Close Boarding</DialogTitle>
          <DialogDescription>
            {view.rules.lock_manifest_on_close
              ? "The manifest locks, final for weight and balance and the reports. It can't be unlocked."
              : "Nothing more can change at check-in. The manifest stays editable, as your settings say."}
          </DialogDescription>
        </DialogHeader>
        {waiting > 0 ? (
          <p className="text-sm text-muted-foreground">
            {`${waiting} standby passenger${waiting === 1 ? "" : "s"} still waiting will be recorded as no seat.`}
          </p>
        ) : null}
        {error ? (
          <Notice tone="red" label="Not closed" role="alert">
            {error}
          </Notice>
        ) : null}
        <DialogFooter className="gap-2">
          <button type="button" className={buttonOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={buttonSolid} disabled={pending} onClick={onConfirm}>
            {pending ? <Spinner size="xs" /> : null}
            Close Boarding
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
