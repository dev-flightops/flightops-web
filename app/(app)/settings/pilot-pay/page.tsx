import Link from "next/link";

import { RemoveRowButton } from "@/components/settings/remove-row-button";
import { getPilotPay, listStaff } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listAircraft } from "@/lib/api/ops";
import type {
  PayModifierRow,
  PayRateRow,
  PilotPayBundleResponse,
} from "@/lib/api/auth";
import { fleetTypes } from "@/lib/fleet-types";

import { removePayModifierAction, removePayRateAction } from "./actions";
import { PayModifierForm, PayRateForm } from "./pay-forms";

/**
 * /settings/pilot-pay — legacy `templates/settings/pilot_pay.html`.
 *
 * Reads live from `/auth/settings/pilot-pay` (M2 backend tail,
 * migration 0056). Two panels — Pay Rate Table + Daily Modifiers.
 *
 * Legacy matched a rate by priority (pilot+airframe > pilot+any >
 * default+airframe > default) when a clocked shift or a flight made a pay
 * event, and applied modifiers the same way. Pay events here are entered by
 * hand, so nothing reads these tables yet, and the page says so (#134).
 *
 * Rows are added and removed, not edited, as in legacy: a new rate with a
 * later effective date takes over from the old one (#134).
 */

export const dynamic = "force-dynamic";

export default async function SettingsPilotPayPage() {
  let data: PilotPayBundleResponse | null = null;
  let loadError: string | null = null;
  try {
    data = await getPilotPay();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "Exec Admin role required to manage pilot pay."
          : "Pilot pay unavailable. Try refreshing in a moment.";
  }

  const rates = data?.rates ?? [];
  const modifiers = data?.modifiers ?? [];

  // For the form and the table's names; either can fail without losing the
  // page. The rate's pilot is a user id, and the picker lists the pilots.
  const [staff, airframes] = await Promise.all([
    listStaff()
      .then((r) => r.items)
      .catch(() => []),
    listAircraft()
      .then((r) => fleetTypes(r.items).map((t) => t.slug))
      .catch(() => [] as string[]),
  ]);
  const pilots = staff
    .filter((s) => s.roles.includes("pilot") || s.roles.includes("chief_pilot"))
    .map((s) => ({ id: s.id, name: s.full_name }));
  const names = new Map(staff.map((s) => [s.id, s.full_name]));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="text-foreground">Pilot Pay</span>
      </nav>

      <header className="mb-6 border-b border-border pb-5">
        <h1 className="page-title">Pilot Pay Rates &amp; Modifiers</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Configure pay rate tables by seniority, airframe, and role. Add daily
          modifiers for medevac, night ops, and other situations. When a flight
          lands, its pay events read the most specific rate in force that day.
          Medevac, night ops, training and check airman apply by themselves; add
          the others by hand on Payroll.
        </p>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="mb-5 notice notice-yellow"
        >
          {loadError}
        </div>
      ) : null}

      <PayRateSection rates={rates} names={names} pilots={pilots} airframes={airframes} canEdit={!loadError} />
      <PayModifierSection modifiers={modifiers} canEdit={!loadError} />

      <Link
        href="/settings"
        className="btn-caps inline-block rounded-md border border-input px-4 py-2 text-foreground hover:bg-accent"
      >
        Back to Settings
      </Link>
    </div>
  );
}

function PayRateSection({
  rates,
  names,
  pilots,
  airframes,
  canEdit,
}: {
  rates: PayRateRow[];
  names: Map<string, string>;
  pilots: { id: string; name: string }[];
  airframes: string[];
  canEdit: boolean;
}) {
  return (
    <section className="mb-5 rounded-lg border border-border bg-card p-5">
      <h2 className="panel-title mb-3">
        Pay Rate Table
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Rates are matched by priority: pilot-specific + airframe &gt; pilot-specific + any airframe &gt; company default + airframe &gt; company default. Seniority range filters narrow further. Most specific match wins.
      </p>

      <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Type</th>
                <th scope="col" className="px-4 py-2 font-semibold">Pilot</th>
                <th scope="col" className="px-4 py-2 font-semibold">Airframe</th>
                <th scope="col" className="px-4 py-2 font-semibold">YOS Range</th>
                <th scope="col" className="px-4 py-2 font-semibold">Rate</th>
                <th scope="col" className="px-4 py-2 font-semibold">Effective</th>
                <th scope="col" className="px-4 py-2 font-semibold">End</th>
                <th scope="col" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No pay rates configured. Add rates below.
                  </td>
                </tr>
              ) : (
                rates.map((r) => (
                  <tr key={r.id} className="hover:bg-accent">
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {r.rate_type === "daily" ? (
                        <span className="eyebrow">
                          Daily
                        </span>
                      ) : (
                        <span className="status-mark text-status-green">
                          Flight Hourly
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {r.crew_member_id ? (names.get(r.crew_member_id) ?? "A specific pilot") : "All Pilots"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {r.airframe_type ?? "All"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {r.year_of_service_min !== null || r.year_of_service_max !== null
                        ? `${r.year_of_service_min ?? 0}–${r.year_of_service_max ?? "99"} yrs`
                        : "Any"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold tabular-nums text-foreground">
                      ${Number(r.rate_amount).toFixed(2)}
                      {r.rate_type === "flight_hourly" ? "/hr" : "/day"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {r.effective_date}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {r.end_date ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <RemoveRowButton
                        label={`Remove the ${r.rate_type === "daily" ? "daily" : "hourly"} rate effective ${r.effective_date}`}
                        confirm="Remove this pay rate?"
                        action={removePayRateAction.bind(null, r.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit ? (
        <div className="border-t border-border pt-3">
          <div className="eyebrow mb-2">Add Pay Rate</div>
          <PayRateForm pilots={pilots} airframes={airframes} />
        </div>
      ) : null}
    </section>
  );
}

function PayModifierSection({ modifiers, canEdit }: { modifiers: PayModifierRow[]; canEdit: boolean }) {
  return (
    <section className="mb-5 rounded-lg border border-border bg-card p-5">
      <h2 className="panel-title mb-3">
        Daily Modifiers
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        What pays extra, such as a medevac flight, a night arrival or a training day.
      </p>

      <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Modifier</th>
                <th scope="col" className="px-4 py-2 font-semibold">Label</th>
                <th scope="col" className="px-4 py-2 font-semibold">Type</th>
                <th scope="col" className="px-4 py-2 font-semibold">Value</th>
                <th scope="col" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {modifiers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No modifiers configured. Add modifiers below.
                  </td>
                </tr>
              ) : (
                modifiers.map((m) => (
                  <tr key={m.id} className="hover:bg-accent">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                      {m.modifier_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {m.display_label}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      <ModifierTypeBadge type={m.modifier_type} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold tabular-nums text-foreground">
                      {formatModifierValue(m)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <RemoveRowButton
                        label={`Remove ${m.display_label}`}
                        confirm={`Remove ${m.display_label}?`}
                        action={removePayModifierAction.bind(null, m.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit ? (
        <div className="border-t border-border pt-3">
          <div className="eyebrow mb-2">Add Modifier</div>
          <PayModifierForm />
        </div>
      ) : null}
    </section>
  );
}

function ModifierTypeBadge({ type }: { type: string }) {
  const cls =
    type === "flat"
      ? "text-status-blue"
      : type === "multiplier"
        ? "text-status-yellow"
        : "text-status-green";
  const label =
    type === "flat"
      ? "Flat"
      : type === "multiplier"
        ? "Multiplier"
        : "Per Hour";
  return (
    <span
      className={
        "status-mark text-[0.65rem] " +
        cls
      }
    >
      {label}
    </span>
  );
}

function formatModifierValue(m: PayModifierRow): string {
  const n = Number(m.modifier_value);
  if (m.modifier_type === "flat") return `$${n.toFixed(2)}`;
  if (m.modifier_type === "multiplier") return `${n}x`;
  return `$${n.toFixed(2)}/hr`;
}
