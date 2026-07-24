import Link from "next/link";

import { getPilotPay } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type {
  PayModifierRow,
  PayRateRow,
  PilotPayBundleResponse,
} from "@/lib/api/auth";

/**
 * /settings/pilot-pay — legacy `templates/settings/pilot_pay.html`.
 *
 * Reads live from `/auth/settings/pilot-pay` (M2 backend tail,
 * migration 0056). Two panels — Pay Rate Table + Daily Modifiers.
 *
 * Rates are matched by priority (pilot+airframe > pilot+any >
 * default+airframe > default) at pay-event time; that lookup lives
 * in the payroll service and isn't exposed here. Modifiers apply
 * automatically when conditions are detected on the pay event
 * (medevac / night / training).
 *
 * Add + Delete endpoints exist backend-side; Add-row modals are a
 * follow-up. Disabled placeholders remain in the inline forms so
 * operators know what fields are coming.
 */

const BACKEND_HINT_ADD =
  "Add / Delete modals are a follow-up — POST/DELETE endpoints are live";

const RATE_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "flight_hourly", label: "Flight Hourly" },
] as const;

const MODIFIER_TYPES = [
  { value: "flat", label: "Flat $" },
  { value: "multiplier", label: "Multiplier" },
  { value: "per_hour", label: "Per Hour" },
] as const;

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="font-semibold text-status-blue">Pilot Pay</span>
      </nav>

      <h1 className="mb-1 text-xl font-bold">Pilot Pay Rates &amp; Modifiers</h1>
      <p className="mb-5 text-xs text-muted-foreground">
        Configure pay rate tables by seniority, airframe, and role. Add daily
        modifiers for medevac, night ops, and other situations.
      </p>

      {loadError ? (
        <div
          role="alert"
          className="mb-5 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : null}

      <PayRateSection rates={rates} />
      <PayModifierSection modifiers={modifiers} />

      <Link
        href="/settings"
        className="inline-block rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/30"
      >
        Back to Settings
      </Link>
    </div>
  );
}

function PayRateSection({ rates }: { rates: PayRateRow[] }) {
  return (
    <section className="mb-5 rounded-lg border border-border bg-card px-4 py-4">
      <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Pay Rate Table
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Rates are matched by priority: pilot-specific + airframe &gt; pilot-specific + any airframe &gt; company default + airframe &gt; company default. Seniority range filters narrow further. Most specific match wins.
      </p>

      <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
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
                  <tr key={r.id} className="hover:bg-muted/5">
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {r.rate_type === "daily" ? (
                        <span className="rounded border border-status-blue/40 bg-status-blue/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-status-blue">
                          Daily
                        </span>
                      ) : (
                        <span className="rounded border border-status-green/40 bg-status-green/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-status-green">
                          Flight Hourly
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {r.crew_member_id ? (
                        <span className="font-mono text-muted-foreground">
                          {r.crew_member_id.slice(0, 8)}
                        </span>
                      ) : (
                        "All Pilots"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {r.airframe_type ?? "All"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {r.year_of_service_min !== null || r.year_of_service_max !== null
                        ? `${r.year_of_service_min ?? 0}–${r.year_of_service_max ?? "99"} yrs`
                        : "Any"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-status-green">
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
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        title={BACKEND_HINT_ADD}
                        className="cursor-not-allowed text-xs text-status-red opacity-60"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">Add Pay Rate</div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Type" width="w-36">
            <DisabledSelect options={RATE_TYPES} />
          </Field>
          <Field label="Pilot" width="w-40">
            <DisabledSelect options={[{ value: "", label: "All Pilots (Default)" }]} />
          </Field>
          <Field label="Airframe" width="w-32">
            <DisabledInput placeholder="e.g. 208B" />
          </Field>
          <Field label="YOS Min" width="w-20">
            <DisabledInput placeholder="0" type="number" />
          </Field>
          <Field label="YOS Max" width="w-20">
            <DisabledInput placeholder="99" type="number" />
          </Field>
          <Field label="Rate ($)" width="w-24">
            <DisabledInput placeholder="350.00" type="number" />
          </Field>
          <Field label="Effective" width="w-36">
            <DisabledInput type="date" />
          </Field>
          <Field label="End Date" width="w-36">
            <DisabledInput type="date" />
          </Field>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT_ADD}
            className="h-[34px] cursor-not-allowed rounded-md bg-status-blue px-3 text-xs font-semibold text-white disabled:opacity-100"
          >
            + Add Rate
          </button>
        </div>
      </div>
    </section>
  );
}

function PayModifierSection({ modifiers }: { modifiers: PayModifierRow[] }) {
  return (
    <section className="mb-5 rounded-lg border border-border bg-card px-4 py-4">
      <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Daily Modifiers
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Modifiers auto-apply when conditions are detected (medevac flight type, night arrival, training). Custom modifiers can be applied manually to pay events.
      </p>

      <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
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
                  <tr key={m.id} className="hover:bg-muted/5">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                      {m.modifier_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {m.display_label}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      <ModifierTypeBadge type={m.modifier_type} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-status-yellow">
                      {formatModifierValue(m)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        title={BACKEND_HINT_ADD}
                        className="cursor-not-allowed text-xs text-status-red opacity-60"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">Add Modifier</div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Modifier" width="w-40">
            <DisabledSelect
              options={[
                { value: "medevac", label: "Medevac Premium" },
                { value: "night", label: "Night Ops" },
                { value: "training", label: "Training Day" },
              ]}
            />
          </Field>
          <Field label="Display Label" width="w-40">
            <DisabledInput placeholder="Medevac Premium" />
          </Field>
          <Field label="Type" width="w-36">
            <DisabledSelect options={MODIFIER_TYPES} />
          </Field>
          <Field label="Value" width="w-24">
            <DisabledInput placeholder="150.00" type="number" />
          </Field>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT_ADD}
            className="h-[34px] cursor-not-allowed rounded-md bg-status-blue px-3 text-xs font-semibold text-white disabled:opacity-100"
          >
            + Add Modifier
          </button>
        </div>
      </div>
    </section>
  );
}

function ModifierTypeBadge({ type }: { type: string }) {
  const cls =
    type === "flat"
      ? "border-status-blue/40 bg-status-blue/10 text-status-blue"
      : type === "multiplier"
        ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
        : "border-status-green/40 bg-status-green/10 text-status-green";
  const label =
    type === "flat"
      ? "Flat"
      : type === "multiplier"
        ? "Multiplier"
        : "Per Hour";
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
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

function Field({
  label,
  width,
  children,
}: {
  label: string;
  width: string;
  children: React.ReactNode;
}) {
  return (
    <label className={width}>
      <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function DisabledInput({
  placeholder,
  type = "text",
}: {
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      disabled
      title={BACKEND_HINT_ADD}
      className="w-full cursor-not-allowed rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-100"
    />
  );
}

function DisabledSelect({
  options,
}: {
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select
      disabled
      title={BACKEND_HINT_ADD}
      className="w-full cursor-not-allowed rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-100"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
