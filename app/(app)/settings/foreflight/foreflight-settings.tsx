"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import type {
  ForeFlightCheck,
  ForeFlightConnection,
  ForeFlightFetch,
  ForeFlightSend,
} from "@/lib/api/integrations";

import {
  checkForeFlightAction,
  disconnectForeFlightAction,
  fetchFromForeFlightAction,
  saveForeFlightKeyAction,
  sendToForeFlightAction,
  setForeFlightPlansAction,
  setForeFlightSendingAction,
} from "./actions";

/**
 * The company's ForeFlight connection (#54): the key, a check of what
 * will and won't match, sending scheduled flights, and the legs that
 * didn't go cleanly; and bringing pilots' plans back (#55).
 */

const BUTTON =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-60";
const PRIMARY =
  "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60";

function when(iso: string | null): string {
  return iso ? `${iso.slice(0, 16).replace("T", " ")}Z` : "never";
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
    >
      {children}
    </p>
  );
}

function CheckResult({ check }: { check: ForeFlightCheck }) {
  if (check.error) return <Alert>{check.error}</Alert>;
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/60 px-3 py-2 text-xs">
      <p>
        Connected to <span className="font-semibold">{check.account_name ?? "the ForeFlight account"}</span>:{" "}
        {check.aircraft} aircraft and {check.crew} crew there.
      </p>
      {check.tails_missing.length > 0 && (
        <p className="mt-1">
          <span className="font-semibold">Not in ForeFlight, so their flights can&rsquo;t go:</span>{" "}
          {check.tails_missing.join(", ")}. Add them to the company&rsquo;s ForeFlight aircraft.
        </p>
      )}
      {check.crew_missing.length > 0 && (
        <p className="mt-1">
          <span className="font-semibold">No ForeFlight user with the same email, so flights go without them:</span>{" "}
          {check.crew_missing.map((c) => `${c.name} (${c.email})`).join(", ")}.
        </p>
      )}
      {check.tails_missing.length === 0 && check.crew_missing.length === 0 && (
        <p className="mt-1">Every active aircraft and crew member matches.</p>
      )}
    </div>
  );
}

function SendResult({ sent }: { sent: ForeFlightSend }) {
  if (sent.error) return <Alert>{sent.error}</Alert>;
  const parts = [
    [sent.created, "created"],
    [sent.updated, "updated"],
    [sent.unchanged, "unchanged"],
    [sent.frozen, "left alone (released)"],
    [sent.removed, "taken out (cancelled)"],
    [sent.failed, "failed"],
  ].filter(([n]) => (n as number) > 0);
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/60 px-3 py-2 text-xs">
      <p>
        {parts.length === 0
          ? "No flights scheduled in the next 72 hours."
          : `Legs: ${parts.map(([n, label]) => `${n} ${label}`).join(", ")}.`}
      </p>
      {sent.problems.map((problem) => (
        <p key={problem} className="mt-1 text-status-red">
          {problem}
        </p>
      ))}
    </div>
  );
}

function FetchResult({ fetched }: { fetched: ForeFlightFetch }) {
  if (fetched.error) return <Alert>{fetched.error}</Alert>;
  const parts = [
    [fetched.linked, "on legs sent from here"],
    [fetched.matched, "matched to a leg"],
    [fetched.waiting, "waiting to be placed"],
    // Plans a dispatcher set aside stay set aside.
    [fetched.fetched - fetched.linked - fetched.matched - fetched.waiting, "set aside earlier"],
    [fetched.failed, "couldn't be read"],
  ].filter(([n]) => (n as number) > 0);
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/60 px-3 py-2 text-xs">
      <p>
        {fetched.fetched === 0 && fetched.failed === 0
          ? "Nothing changed in ForeFlight since the last fetch."
          : `Plans: ${parts.map(([n, label]) => `${n} ${label}`).join(", ")}.`}
      </p>
    </div>
  );
}

export function ForeFlightSettings({
  connection,
  canReview = false,
}: {
  connection: ForeFlightConnection;
  /** The viewer may place waiting plans (PLAN_REVIEWERS), so gets the link. */
  canReview?: boolean;
}) {
  const [key, setKey] = useState("");
  const [check, setCheck] = useState<ForeFlightCheck | null>(null);
  const [sent, setSent] = useState<ForeFlightSend | null>(null);
  const [fetched, setFetched] = useState<ForeFlightFetch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(action);
  }

  const saveKey = () =>
    run(async () => {
      const outcome = await saveForeFlightKeyAction(key);
      if (!outcome.ok) return setError(outcome.error);
      setKey("");
      setCheck(outcome.value);
    });
  const runCheck = () =>
    run(async () => {
      const outcome = await checkForeFlightAction();
      if (outcome.ok) setCheck(outcome.value);
      else setError(outcome.error);
    });
  const sendNow = () =>
    run(async () => {
      const outcome = await sendToForeFlightAction();
      if (outcome.ok) setSent(outcome.value);
      else setError(outcome.error);
    });
  const setSending = (on: boolean) =>
    run(async () => {
      const outcome = await setForeFlightSendingAction(on);
      if (!outcome.ok) setError(outcome.error);
    });
  const fetchNow = () =>
    run(async () => {
      const outcome = await fetchFromForeFlightAction();
      if (outcome.ok) setFetched(outcome.value);
      else setError(outcome.error);
    });
  const setPlans = (on: boolean) =>
    run(async () => {
      const outcome = await setForeFlightPlansAction(on);
      if (!outcome.ok) setError(outcome.error);
    });
  const disconnect = () =>
    run(async () => {
      const outcome = await disconnectForeFlightAction();
      if (!outcome.ok) return setError(outcome.error);
      setConfirmDisconnect(false);
      setCheck(null);
      setSent(null);
      setFetched(null);
    });

  const status = !connection.has_key
    ? "Not connected"
    : connection.last_error
      ? "Key saved, but the last check failed"
      : connection.account_name
        ? `Connected to ${connection.account_name}`
        : "Key saved, not checked yet";
  const legs = connection.legs;

  return (
    <div className="space-y-6">
      <section aria-labelledby="ff-connection" className="rounded-lg border border-border bg-card p-4">
        <h2 id="ff-connection" className="text-sm font-bold tracking-tight">
          Connection
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your ForeFlight Dispatch administrator generates the key under Tools → API Console →
          Generate API Key. It&rsquo;s stored write-only: it can be replaced, never read back.
          ForeFlight Mobile alone isn&rsquo;t enough; the connection goes through Dispatch.
        </p>
        <p className="mt-2 text-xs">
          <span
            className={
              "mr-2 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] " +
              (connection.has_key && connection.account_name && !connection.last_error
                ? "bg-status-green/15 text-status-green"
                : "bg-muted text-muted-foreground")
            }
          >
            {connection.has_key ? "Key saved" : "No key"}
          </span>
          <span>{status}</span>
          {connection.checked_at && (
            <span className="text-muted-foreground"> · checked {when(connection.checked_at)}</span>
          )}
        </p>
        {/* A check just run shows its own outcome below. */}
        {connection.last_error && !check && <Alert>{connection.last_error}</Alert>}

        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveKey();
          }}
        >
          <label htmlFor="ff-key" className="sr-only">
            ForeFlight API key
          </label>
          <input
            id="ff-key"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={connection.has_key ? "Paste a new key to replace it" : "Paste the API key"}
            className="ff-input min-w-[18rem] flex-1"
          />
          <button type="submit" disabled={pending || key.trim().length < 8} className={PRIMARY}>
            {pending && <Spinner size="xs" />}
            {connection.has_key ? "Replace key" : "Save key"}
          </button>
          {connection.has_key && (
            <button type="button" onClick={runCheck} disabled={pending} className={BUTTON}>
              Check connection
            </button>
          )}
          {connection.has_key &&
            (confirmDisconnect ? (
              <span className="flex items-center gap-2 text-xs">
                Disconnect? Flights already sent stay in ForeFlight.
                <button type="button" onClick={disconnect} disabled={pending} className={PRIMARY}>
                  Disconnect
                </button>
                <button type="button" onClick={() => setConfirmDisconnect(false)} className={BUTTON}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDisconnect(true)} className={BUTTON}>
                Disconnect…
              </button>
            ))}
        </form>
        {check && <CheckResult check={check} />}
      </section>

      <section aria-labelledby="ff-sending" className="rounded-lg border border-border bg-card p-4">
        <h2 id="ff-sending" className="text-sm font-bold tracking-tight">
          Send scheduled flights to ForeFlight
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Each leg of a flight scheduled in the next 72 hours appears in ForeFlight with its crew,
          passengers and cargo, so the pilot&rsquo;s weight and balance starts loaded. Changes follow
          until the flight is released, here or in ForeFlight. A cancelled flight is taken out unless
          ForeFlight already released it. Runs every five minutes once on.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={
              "rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] " +
              (connection.send_flights ? "bg-status-green/15 text-status-green" : "bg-muted text-muted-foreground")
            }
          >
            {connection.send_flights ? "On" : "Off"}
          </span>
          <button
            type="button"
            onClick={() => setSending(!connection.send_flights)}
            disabled={pending || !connection.has_key}
            title={connection.has_key ? undefined : "Save the API key first"}
            className={BUTTON}
          >
            {connection.send_flights ? "Turn off" : "Turn on"}
          </button>
          <button type="button" onClick={sendNow} disabled={pending || !connection.has_key} className={BUTTON}>
            Send now
          </button>
          <span className="text-muted-foreground">
            Last sent {when(connection.last_sync_at)}
            {(legs.sent ?? 0) + (legs.frozen ?? 0) > 0 &&
              ` · ${legs.sent ?? 0} legs up to date, ${legs.frozen ?? 0} released`}
          </span>
        </div>
        {sent && <SendResult sent={sent} />}
      </section>

      <section aria-labelledby="ff-plans" className="rounded-lg border border-border bg-card p-4">
        <h2 id="ff-plans" className="text-sm font-bold tracking-tight">
          Bring pilots&rsquo; plans back
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The flights pilots plan or change in ForeFlight come back with their route, fuel, times and
          ForeFlight&rsquo;s weight and balance. A leg sent from here is found by its link; a
          pilot&rsquo;s own flight by its tail, airports and time. The plan shows on the flight&rsquo;s
          dispatch page beside Peregrine&rsquo;s weight and balance check, which stays the record. A
          plan no single leg fits waits for dispatch or the DO to place it. Runs every five minutes once
          on.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={
              "rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] " +
              (connection.bring_plans ? "bg-status-green/15 text-status-green" : "bg-muted text-muted-foreground")
            }
          >
            {connection.bring_plans ? "On" : "Off"}
          </span>
          <button
            type="button"
            onClick={() => setPlans(!connection.bring_plans)}
            disabled={pending || !connection.has_key}
            title={connection.has_key ? undefined : "Save the API key first"}
            className={BUTTON}
          >
            {connection.bring_plans ? "Turn off" : "Turn on"}
          </button>
          <button type="button" onClick={fetchNow} disabled={pending || !connection.has_key} className={BUTTON}>
            Fetch now
          </button>
          <span className="text-muted-foreground">Last fetched {when(connection.last_fetch_at)}</span>
          {connection.plans_waiting > 0 && (
            <span>
              {`· ${connection.plans_waiting} ${connection.plans_waiting === 1 ? "plan" : "plans"} waiting to be placed`}
              {canReview && (
                <>
                  {" "}
                  <Link href="/dispatch/foreflight-plans" className="font-semibold text-primary hover:underline">
                    Review
                  </Link>
                </>
              )}
            </span>
          )}
        </div>
        {fetched && <FetchResult fetched={fetched} />}
      </section>

      {connection.problems.length > 0 && (
        <section aria-labelledby="ff-problems" className="rounded-lg border border-border bg-card p-4">
          <h2 id="ff-problems" className="text-sm font-bold tracking-tight">
            Legs that need attention
          </h2>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-semibold">Flight</th>
                <th className="py-1 pr-3 font-semibold">Leg</th>
                <th className="py-1 pr-3 font-semibold">Departs</th>
                <th className="py-1 font-semibold">What happened</th>
              </tr>
            </thead>
            <tbody>
              {connection.problems.map((p) => (
                <tr key={`${p.flight_id}-${p.leg_sequence}`} className="border-t border-border">
                  <td className="py-1 pr-3 font-mono">{p.flight_number}</td>
                  <td className="py-1 pr-3">{p.leg_sequence}</td>
                  <td className="py-1 pr-3">{when(p.departs_at)}</td>
                  <td className={"py-1 " + (p.state === "failed" ? "text-status-red" : "")}>{p.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
