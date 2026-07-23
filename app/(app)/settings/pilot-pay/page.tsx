import Link from "next/link";

/**
 * /settings/pilot-pay — legacy `templates/settings/pilot_pay.html`.
 *
 * Two panels — Pay Rate Table + Daily Modifiers — each with a
 * column table + inline add form. Rates are matched by priority:
 * pilot+airframe > pilot+any > default+airframe > default. Modifiers
 * auto-apply on medevac / night / training conditions; custom
 * modifiers apply manually to pay events.
 *
 * No pay-rate backend yet — Marc's M2 crew-service Payroll story
 * still to land. All CTAs disabled with milestone tooltips.
 */

const BACKEND_HINT =
  "Pilot pay rates ship with the crew-service Payroll backend (M2)";

const RATE_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "flight_hourly", label: "Flight Hourly" },
] as const;

const MODIFIER_TYPES = [
  { value: "flat", label: "Flat $" },
  { value: "multiplier", label: "Multiplier" },
  { value: "per_hour", label: "Per Hour" },
] as const;

export default function SettingsPilotPayPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          /
        </span>
        <span className="font-semibold text-status-blue">Pilot Pay</span>
      </nav>

      <h1 className="mb-1 text-xl font-bold">Pilot Pay Rates &amp; Modifiers</h1>
      <p className="mb-5 text-xs text-muted-foreground">
        Configure pay rate tables by seniority, airframe, and role. Add daily
        modifiers for medevac, night ops, and other situations.
      </p>

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
              <tbody>
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No pay rates configured. Add rates below.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Add Pay Rate</div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Type" width="w-36">
              <DisabledSelect options={RATE_TYPES} title={BACKEND_HINT} />
            </Field>
            <Field label="Pilot" width="w-40">
              <DisabledSelect options={[{ value: "", label: "All Pilots (Default)" }]} title={BACKEND_HINT} />
            </Field>
            <Field label="Airframe" width="w-32">
              <DisabledInput placeholder="e.g. 208B" title={BACKEND_HINT} />
            </Field>
            <Field label="YOS Min" width="w-20">
              <DisabledInput placeholder="0" type="number" title={BACKEND_HINT} />
            </Field>
            <Field label="YOS Max" width="w-20">
              <DisabledInput placeholder="99" type="number" title={BACKEND_HINT} />
            </Field>
            <Field label="Rate ($)" width="w-24">
              <DisabledInput placeholder="350.00" type="number" title={BACKEND_HINT} />
            </Field>
            <Field label="Effective" width="w-36">
              <DisabledInput type="date" title={BACKEND_HINT} />
            </Field>
            <Field label="End Date" width="w-36">
              <DisabledInput type="date" title={BACKEND_HINT} />
            </Field>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={BACKEND_HINT}
              className="h-[34px] cursor-not-allowed rounded-md bg-status-blue px-3 text-xs font-semibold text-white disabled:opacity-100"
            >
              + Add Rate
            </button>
          </div>
        </div>
      </section>

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
              <tbody>
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No modifiers configured. Add modifiers below.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Add Modifier</div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Modifier" width="w-40">
              <DisabledSelect
                title={BACKEND_HINT}
                options={[
                  { value: "medevac", label: "Medevac Premium" },
                  { value: "night", label: "Night Ops" },
                  { value: "training", label: "Training Day" },
                ]}
              />
            </Field>
            <Field label="Display Label" width="w-40">
              <DisabledInput placeholder="Medevac Premium" title={BACKEND_HINT} />
            </Field>
            <Field label="Type" width="w-36">
              <DisabledSelect options={MODIFIER_TYPES} title={BACKEND_HINT} />
            </Field>
            <Field label="Value" width="w-24">
              <DisabledInput placeholder="150.00" type="number" title={BACKEND_HINT} />
            </Field>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={BACKEND_HINT}
              className="h-[34px] cursor-not-allowed rounded-md bg-status-blue px-3 text-xs font-semibold text-white disabled:opacity-100"
            >
              + Add Modifier
            </button>
          </div>
        </div>
      </section>

      <Link
        href="/settings"
        className="inline-block rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/30"
      >
        Back to Settings
      </Link>
    </div>
  );
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
  title,
}: {
  placeholder?: string;
  type?: string;
  title: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      disabled
      title={title}
      className="w-full cursor-not-allowed rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-100"
    />
  );
}

function DisabledSelect({
  options,
  title,
}: {
  options: readonly { value: string; label: string }[];
  title: string;
}) {
  return (
    <select
      disabled
      title={title}
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
