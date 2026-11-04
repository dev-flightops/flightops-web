"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonSolid, linkCaps } from "@/components/ff/controls";
import type { DemoPreparation, DemoStatus } from "@/lib/api/demo";
import { prepareDemoAction } from "./actions";

export function DemoForm({ status }: { status: DemoStatus }) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoPreparation | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="max-w-2xl space-y-6">
      <p>Prepare fresh examples for {status.company_name}. Flights are timed around when you prepare the demo; housing and fuel examples use the company’s local day ({status.timezone}).</p>
      <p>This replaces the prepared aircraft, flights, bookings, charter requests, invoices, fuel orders, housing and safety examples, including walkthrough activity linked to them. The reserved demo pilot’s duty, flight logs and Academy progress are also refreshed. Company settings, ordinary staff records and user accounts stay in place.</p>
      {status.last_prepared_at && <p>Last prepared: {new Date(status.last_prepared_at).toLocaleString("en-US", { timeZone: status.timezone })} ({status.timezone}). {status.last_company_date !== status.company_date && "Prepare again to refresh the examples for today."}</p>}
      <form method="post" className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setResult(null);
        setPending(true);
        void (async () => {
          try {
            const response = await prepareDemoAction(confirmation);
            if (response.error) setError(response.error);
            else if (response.result) { setResult(response.result); setConfirmation(""); }
          } catch {
            setError("The connection was interrupted. Refresh this page to check the last preparation before trying again.");
          } finally { setPending(false); }
        })();
      }}>
        <label className="block space-y-2">
          <span>Type <strong>{status.company_name}</strong> to replace the prepared examples.</span>
          <input aria-label="Confirm company name" className="block w-full rounded border border-current bg-transparent p-3" value={confirmation} disabled={pending} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
        </label>
        <button type="submit" className={buttonSolid} disabled={pending || confirmation !== status.company_name}>
          {pending ? "Preparing today’s demo…" : "Prepare today’s demo"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && <div role="status" className="space-y-2">
        <p>Demo ready for {result.company_date} ({result.timezone}).</p>
        <p>{result.summary.flights} flights, {result.summary.aircraft} aircraft, {result.summary.bookings ?? 0} bookings, {result.summary.confirmed_charters ?? 0} confirmed charter and {result.summary.invoices ?? 0} invoice are ready, along with fuel, housing and safety examples.</p>
        <p>Look for flights DEMO101–DEMO107 and aircraft N91DM–N96DM. DEMO101 provides completed flight hours; DEMO102 is airborne; DEMO103 is released; DEMO104 has passengers and DEMO107 is its return. N96DM is grounded. Use Prepared Demo Pilot for the pilot workflow.</p>
        <nav aria-label="Prepared demo examples" className="flex flex-wrap gap-4">
          <Link className={linkCaps} href="/reservations/fleet-board">Open Fleet Board</Link>
          <Link className={linkCaps} href="/flight-following">Flight Following</Link>
          <Link className={linkCaps} href="/fuel/orders">Fuel Orders</Link>
          <Link className={linkCaps} href="/housing/">Housing</Link>
          <Link className={linkCaps} href="/safety/">Safety</Link>
        </nav>
      </div>}
      <p>Dispatch release still requires the normal crew, weather, risk and acknowledgment checks. Preparing examples does not waive those checks.</p>
    </div>
  );
}
