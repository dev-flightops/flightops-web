import Link from "next/link";

import { getOperatingCosts } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listFuelTypes } from "@/lib/api/ground";
import { listAircraft } from "@/lib/api/ops";
import { RemoveRowButton } from "@/components/settings/remove-row-button";
import { removeCostRowAction } from "./actions";
import { AircraftTypeForm } from "./aircraft-type-form";
import { FuelPriceForm, LandingFeeForm, RouteTimeForm } from "./cost-forms";
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
 * The aircraft type form came first (#75): the load plan needs each type's
 * burn rate and fuel to estimate a trip's fuel. Fuel prices, landing fees and
 * route times followed (#134): saving a row already on the list replaces it,
 * and each has a Remove.
 */

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

  // For the aircraft type form: the company's fuels, and the names to
  // suggest as types: each aircraft's airframe type, else its model, which
  // is how costing and the fuel estimate look a type up. Either can fail
  // without losing the page.
  const [fuelTypes, fleet] = await Promise.all([
    listFuelTypes().then((r) => r.items.map((f) => ({ code: f.code, label: f.label }))).catch(() => []),
    listAircraft()
      .then((r) => [...new Set(r.items.map((a) => a.airframe_type || a.model).filter((m): m is string => !!m))])
      .catch(() => [] as string[]),
  ]);

  const aircraft = data?.aircraft_costs ?? [];
  const fuelPrices = data?.fuel_prices ?? [];
  const landingFees = data?.landing_fees ?? [];
  const routes = data?.routes ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="text-foreground">Costs</span>
      </nav>

      <header className="mb-6 border-b border-border pb-5">
        <h1 className="page-title">Aircraft Operating Cost Configuration</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Feeds directly into Dispatch AI Intelligence cost calculations
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

      <AircraftCostsSection rows={aircraft} fuelTypes={fuelTypes} fleetTypes={fleet} canEdit={!loadError} />
      <FuelPricesSection rows={fuelPrices} canEdit={!loadError} />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LandingFeesSection rows={landingFees} canEdit={!loadError} />
        <RoutesSection rows={routes} canEdit={!loadError} />
      </div>

      <CalculatorSection aircraft={aircraft} fuelPrices={fuelPrices} />
    </div>
  );
}

function AircraftCostsSection({
  rows,
  fuelTypes,
  fleetTypes,
  canEdit,
}: {
  rows: AircraftCostRow[];
  fuelTypes: { code: string; label: string }[];
  fleetTypes: string[];
  canEdit: boolean;
}) {
  const fuelLabel = (code: string | null | undefined) =>
    code ? (fuelTypes.find((f) => f.code.toLowerCase() === code.toLowerCase())?.label ?? code) : "—";
  return (
    <section className="mb-5 rounded-lg border border-border bg-card p-5">
      <h2 className="panel-title mb-3">
        Aircraft Type Operating Costs (per flight hour)
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Type</th>
                <th scope="col" className="px-4 py-2 font-semibold">Fuel GPH</th>
                <th scope="col" className="px-4 py-2 font-semibold">Fuel</th>
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
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No aircraft types configured. Add one below.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const pilotHourly = pilotPerHour(r);
                  const directCost = directCostPerHour(r);
                  return (
                    <tr key={r.id} className="hover:bg-accent">
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                        {r.aircraft_type}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {r.fuel_burn_gph ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">{fuelLabel(r.fuel_type_code)}</td>
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
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-foreground">
                        {pilotHourly === null ? "—" : `$${pilotHourly.toFixed(0)}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-foreground">
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
      {canEdit ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary">+ Add / Edit Aircraft Type</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {`Name the type by the aircraft’s airframe type (caravan, ga8, …), or its model when it has none; the suggestions list them. Dispatch Intelligence costs flights by it, and a manifest estimates a trip’s fuel from its fuel burn and fuel when dispatch hasn’t entered the fuel.`}
          </p>
          <AircraftTypeForm rows={rows} fuelTypes={fuelTypes} fleetTypes={fleetTypes} />
        </details>
      ) : null}
    </section>
  );
}

function FuelPricesSection({ rows, canEdit }: { rows: FuelPriceRow[]; canEdit: boolean }) {
  return (
    <section className="mb-5 rounded-lg border border-border bg-card p-5">
      <h2 className="panel-title mb-3">
        Fuel Prices by Base ($/gal)
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No fuel prices configured. Add one below.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
          {rows.map((r) => (
            <div
              key={r.id}
              className="border-l-2 border-input py-0.5 pl-3"
            >
              <div className="font-mono text-sm font-semibold">{r.icao_code}</div>
              <div className="text-foreground">
                <span className="font-bold tabular-nums">${Number(r.price_per_gal).toFixed(2)}</span>
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  /gal · {r.fuel_type}
                </span>
              </div>
              {canEdit ? (
                <RemoveRowButton
                  label={`Remove the ${r.fuel_type} price at ${r.icao_code}`}
                  confirm={`Remove the ${r.fuel_type} price at ${r.icao_code}?`}
                  action={removeCostRowAction.bind(null, "fuel-price", r.id)}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
      {canEdit ? (
        <AddDetails label="+ Add / Edit Fuel Price">
          <FuelPriceForm />
        </AddDetails>
      ) : null}
    </section>
  );
}

function LandingFeesSection({ rows, canEdit }: { rows: LandingFeeRow[]; canEdit: boolean }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="panel-title mb-3">
        Landing Fees
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No landing fees configured. Add one below.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex justify-between py-1.5 text-sm"
            >
              <span className="font-mono">{r.icao_code}</span>
              <span className="flex items-baseline gap-3 text-muted-foreground">
                <span>
                  ${Number(r.fee_amount).toFixed(0)}
                  {r.notes && ` · ${r.notes}`}
                </span>
                {canEdit ? (
                  <RemoveRowButton
                    label={`Remove the landing fee at ${r.icao_code}`}
                    confirm={`Remove the landing fee at ${r.icao_code}?`}
                    action={removeCostRowAction.bind(null, "landing-fee", r.id)}
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <AddDetails label="+ Add / Edit Landing Fee">
          <LandingFeeForm />
        </AddDetails>
      ) : null}
    </section>
  );
}

function RoutesSection({ rows, canEdit }: { rows: RouteFlightTimeRow[]; canEdit: boolean }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="panel-title mb-3">
        Route Flight Times
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No route flight times configured. Add one below.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex justify-between py-1.5 text-sm"
            >
              <span className="font-mono">
                {r.origin_icao} → {r.dest_icao}
              </span>
              <span className="flex items-baseline gap-3 text-muted-foreground">
                {Number(r.est_flight_hrs).toFixed(1)}h
                {canEdit ? (
                  <RemoveRowButton
                    label={`Remove the route ${r.origin_icao} to ${r.dest_icao}`}
                    confirm={`Remove the route ${r.origin_icao} to ${r.dest_icao}?`}
                    action={removeCostRowAction.bind(null, "route", r.id)}
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <AddDetails label="+ Add / Edit Route">
          <RouteTimeForm />
        </AddDetails>
      ) : null}
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
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="panel-title mb-3">
          Cost Per Flight Hour Calculator
        </h2>
        <p className="text-xs text-muted-foreground">
          Calculator populates once both Aircraft Type Costs and Fuel Prices by
          Base have data. Values include fuel + engine/prop reserves + mx + oil
          + crew. These feed directly into Dispatch AI Intelligence card costs.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="panel-title mb-3">
        Cost Per Flight Hour Calculator
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Total hourly rate by aircraft type and departure base
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="ff-thead">
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
                    <span className="font-normal text-muted-foreground">
                      ${Number(fp.price_per_gal).toFixed(2)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aircraft.map((ac) => (
                <tr key={ac.id} className="hover:bg-accent">
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                    {ac.aircraft_type}
                  </td>
                  {fuelPrices.map((fp) => {
                    const total = totalCostPerHour(ac, fp);
                    return (
                      <td
                        key={fp.id}
                        className="whitespace-nowrap px-4 py-3 font-mono text-xs text-foreground"
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

function AddDetails({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary">{label}</summary>
      {children}
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
