import Link from "next/link";

import { getOperatingCosts } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type {
  AircraftCostRow,
  FuelPriceRow,
  LandingFeeRow,
  OperatingCostsResponse,
  RouteFlightTimeRow,
} from "@/lib/api/auth";

/**
 * /settings/costs — legacy `templates/settings/costs.html`.
 *
 * Reads live from `/auth/settings/costs` (M2 backend tail —
 * migration 0055 added the 4 tables). Renders:
 *   1. Aircraft Type Costs table with derived Pilot $/hr and
 *      Cost/hr* (fuel excluded)
 *   2. Fuel Prices by Base grid
 *   3. Landing Fees + Route Flight Times two-column pair
 *   4. Cost Per Flight Hour Calculator (aircraft × base matrix,
 *      only when both above sections have data)
 *
 * Add/Edit dialogs land in a follow-up — the endpoints exist
 * (POST /settings/costs/aircraft-type, /fuel-price, /landing-fee,
 * /route + DELETE /settings/costs/{resource}/{id}) but the modal
 * UI isn't wired yet. Header controls stay disabled until then.
 */

const BACKEND_HINT_EDIT =
  "Add/Edit form is a follow-up — backend endpoints (POST/DELETE) are live";

export const dynamic = "force-dynamic";

export default async function SettingsCostsPage() {
  let data: OperatingCostsResponse | null = null;
  let loadError: string | null = null;
  try {
    data = await getOperatingCosts();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "Exec Admin role required to view operating cost configuration."
          : "Operating costs unavailable. Try refreshing in a moment.";
  }

  const aircraft = data?.aircraft_costs ?? [];
  const fuelPrices = data?.fuel_prices ?? [];
  const landingFees = data?.landing_fees ?? [];
  const routes = data?.routes ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="font-semibold text-status-blue">Costs</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-lg font-bold">Aircraft Operating Cost Configuration</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Feeds directly into Dispatch AI Intelligence cost calculations
        </p>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="mb-5 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : null}

      <AircraftCostsSection rows={aircraft} />
      <FuelPricesSection rows={fuelPrices} />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LandingFeesSection rows={landingFees} />
        <RoutesSection rows={routes} />
      </div>

      <CalculatorSection aircraft={aircraft} fuelPrices={fuelPrices} />
    </div>
  );
}

function AircraftCostsSection({ rows }: { rows: AircraftCostRow[] }) {
  return (
    <section className="mb-5 rounded-lg border border-border bg-card px-4 py-4">
      <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Aircraft Type Operating Costs (per flight hour)
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Type</th>
                <th scope="col" className="px-4 py-2 font-semibold">Fuel GPH</th>
                <th scope="col" className="px-4 py-2 font-semibold">Engine Rsv</th>
                <th scope="col" className="px-4 py-2 font-semibold">Prop Rsv</th>
                <th scope="col" className="px-4 py-2 font-semibold">Mx Rsv</th>
                <th scope="col" className="px-4 py-2 font-semibold">Oil</th>
                <th scope="col" className="px-4 py-2 font-semibold">Pilot $/day</th>
                <th scope="col" className="px-4 py-2 font-semibold">Duty Hrs</th>
                <th scope="col" className="px-4 py-2 font-semibold">Pilot $/hr</th>
                <th scope="col" className="px-4 py-2 font-semibold">Cost/hr *</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No aircraft types configured. Add one below.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const pilotHourly = pilotPerHour(r);
                  const directCost = directCostPerHour(r);
                  return (
                    <tr key={r.id} className="hover:bg-muted/5">
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                        {r.aircraft_type}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {r.fuel_burn_gph ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {formatDollar(r.engine_reserve_hr)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {formatDollar(r.prop_reserve_hr)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {formatDollar(r.maintenance_hr)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {formatDollar(r.oil_consumables_hr)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {formatDollar(r.pilot_daily_rate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {r.avg_duty_hrs ?? "—"}h
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-status-blue">
                        {pilotHourly === null ? "—" : `$${pilotHourly.toFixed(0)}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-status-green">
                        {directCost === null ? "—" : `$${directCost.toFixed(0)}`}
                        <span className="ml-1 font-normal text-muted-foreground">+ fuel</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        * Cost/hr excludes fuel — fuel varies by base. Total = fuel (GPH ×
        base price) + reserves + crew.
      </p>
      <DisabledAddDetails label="+ Add / Edit Aircraft Type" hint={BACKEND_HINT_EDIT}>
        {[
          { label: "Aircraft Type", placeholder: "Cessna 208B" },
          { label: "Fuel Burn (GPH)", placeholder: "65", type: "number" },
          { label: "Engine Reserve $/hr", placeholder: "175", type: "number" },
          { label: "Prop Reserve $/hr", placeholder: "25", type: "number" },
          { label: "Mx Reserve $/hr", placeholder: "100", type: "number" },
          { label: "Oil & Consumables $/hr", placeholder: "12", type: "number" },
          { label: "Pilot Pay $/day", placeholder: "350", type: "number" },
          { label: "Avg Duty Hours/day", placeholder: "8", type: "number" },
          { label: "Insurance $/hr", placeholder: "0", type: "number" },
        ]}
      </DisabledAddDetails>
    </section>
  );
}

function FuelPricesSection({ rows }: { rows: FuelPriceRow[] }) {
  return (
    <section className="mb-5 rounded-lg border border-border bg-card px-4 py-4">
      <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Fuel Prices by Base ($/gal)
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No fuel prices configured. Add one below.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded border border-border bg-background px-3 py-2"
            >
              <div className="font-mono text-sm font-semibold">{r.icao_code}</div>
              <div className="text-status-green">
                <span className="font-bold">${Number(r.price_per_gal).toFixed(2)}</span>
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  /gal · {r.fuel_type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <DisabledAddDetails label="+ Add / Edit Fuel Price" hint={BACKEND_HINT_EDIT}>
        {[
          { label: "ICAO", placeholder: "PABE" },
          { label: "$/gal", placeholder: "7.50", type: "number" },
        ]}
      </DisabledAddDetails>
    </section>
  );
}

function LandingFeesSection({ rows }: { rows: LandingFeeRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Landing Fees
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No landing fees configured. Add one below.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex justify-between rounded bg-background px-2 py-1 text-sm"
            >
              <span className="font-mono">{r.icao_code}</span>
              <span className="text-muted-foreground">
                ${Number(r.fee_amount).toFixed(0)}
                {r.notes && ` · ${r.notes}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoutesSection({ rows }: { rows: RouteFlightTimeRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Route Flight Times
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No route flight times configured. Add one below.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex justify-between rounded bg-background px-2 py-1 text-sm"
            >
              <span className="font-mono">
                {r.origin_icao} → {r.dest_icao}
              </span>
              <span className="text-muted-foreground">
                {Number(r.est_flight_hrs).toFixed(1)}h
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CalculatorSection({
  aircraft,
  fuelPrices,
}: {
  aircraft: AircraftCostRow[];
  fuelPrices: FuelPriceRow[];
}) {
  if (aircraft.length === 0 || fuelPrices.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card px-4 py-4">
        <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Cost Per Flight Hour Calculator
        </div>
        <p className="text-xs text-muted-foreground">
          Calculator populates once both Aircraft Type Costs and Fuel Prices by
          Base have data. Values include fuel + engine/prop reserves + mx + oil
          + crew. These feed directly into Dispatch AI Intelligence card costs.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Cost Per Flight Hour Calculator
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Total hourly rate by aircraft type and departure base
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Aircraft</th>
                {fuelPrices.map((fp) => (
                  <th
                    key={fp.id}
                    scope="col"
                    className="px-4 py-2 font-semibold"
                  >
                    {fp.icao_code}
                    <br />
                    <span className="font-normal opacity-60">
                      ${Number(fp.price_per_gal).toFixed(2)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aircraft.map((ac) => (
                <tr key={ac.id} className="hover:bg-muted/5">
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                    {ac.aircraft_type}
                  </td>
                  {fuelPrices.map((fp) => {
                    const total = totalCostPerHour(ac, fp);
                    return (
                      <td
                        key={fp.id}
                        className="whitespace-nowrap px-4 py-3 font-mono text-xs text-status-green"
                      >
                        {total === null ? "—" : `$${total.toFixed(0)}`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Values include fuel + engine/prop reserves + mx + oil + crew. These feed
        directly into Dispatch AI Intelligence card costs.
      </p>
    </section>
  );
}

function DisabledAddDetails({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: Array<{ label: string; placeholder: string; type?: string }>;
}) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs text-status-blue">{label}</summary>
      <div className="mt-3 flex flex-wrap gap-2">
        {children.map((f) => (
          <label key={f.label} className="min-w-[120px]">
            <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {f.label}
            </span>
            <input
              type={f.type ?? "text"}
              placeholder={f.placeholder}
              disabled
              title={hint}
              className="w-full cursor-not-allowed rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-100"
            />
          </label>
        ))}
        <div className="flex items-end">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={hint}
            className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-100"
          >
            Save
          </button>
        </div>
      </div>
    </details>
  );
}

// ---- Derivation helpers (mirror legacy calc in costs.html) ------------------

function toNumber(v: string | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pilotPerHour(r: AircraftCostRow): number | null {
  const daily = toNumber(r.pilot_daily_rate);
  const duty = toNumber(r.avg_duty_hrs);
  if (daily === null || duty === null || duty === 0) return null;
  return daily / duty;
}

function directCostPerHour(r: AircraftCostRow): number | null {
  const engine = toNumber(r.engine_reserve_hr) ?? 0;
  const prop = toNumber(r.prop_reserve_hr) ?? 0;
  const mx = toNumber(r.maintenance_hr) ?? 0;
  const oil = toNumber(r.oil_consumables_hr) ?? 0;
  const insurance = toNumber(r.insurance_hr) ?? 0;
  const pilotHr = pilotPerHour(r) ?? 0;
  return engine + prop + mx + oil + insurance + pilotHr;
}

function totalCostPerHour(
  ac: AircraftCostRow,
  fp: FuelPriceRow,
): number | null {
  const gph = toNumber(ac.fuel_burn_gph);
  const price = toNumber(fp.price_per_gal);
  const direct = directCostPerHour(ac);
  if (gph === null || price === null || direct === null) return null;
  return gph * price + direct;
}

function formatDollar(v: string | null): string {
  const n = toNumber(v);
  if (n === null) return "—";
  return `$${n.toFixed(0)}`;
}
