import { ApiError } from "@/lib/api/client";
import { listSupplierBases } from "@/lib/api/ground";
import type {
  FlightDetail,
  FuelSupplierBaseResponse,
} from "@/lib/api/types";

import { DisabledPanel, SectionPanel } from "./section-panel";

/**
 * Fuel Order panel — reads the supplier × base × fuel_type pricing
 * matrix shipped in M2-M-25c and surfaces it on the dispatch packet.
 *
 * What it shows when a flight is selected:
 *   - Auto-selected fuel type (mapped from aircraft model)
 *   - Default supplier for departure base (is_default=true)
 *   - Contract price per gallon
 *   - Form fields: gallons (required), requested time, special instructions
 *   - "Order Fuel" button DISABLED pending M2-M-27b
 *     (fuel_orders table + supplier email/notification pipeline)
 *
 * Why the button is disabled: M2-M-25c only added the directory + pricing
 * matrix backend. The actual order workflow — FuelOrder model, supplier
 * notification, status state machine, ramp-staff push — is M2-M-27b and
 * hasn't been built. The legacy spec mandates an Order Fuel button at
 * dispatch time, so we render the full form chrome with a "Order
 * workflow coming in M2-M-27b" tooltip on submit. Dispatchers see the
 * pricing + supplier they would order from today.
 */
export async function FuelOrderPanel({
  flight,
}: {
  flight: FlightDetail | null;
}) {
  if (!flight) {
    return (
      <DisabledPanel
        title="Fuel"
        milestone="M2"
        hint="Pick a flight from the dropdown above to see the configured supplier + contract price for the departure base."
        accent="yellow"
      />
    );
  }

  const baseCode = flight.origin;
  const fuelTypeCode = fuelTypeForAircraft(flight.aircraft.model);

  let supplierBases: FuelSupplierBaseResponse[] = [];
  let loadError: string | null = null;
  try {
    const result = await listSupplierBases({ baseCode });
    // Filter by the auto-selected fuel type on the client; the backend
    // filter is by fuel_type_id (uuid) but we only have a code here.
    supplierBases = result.items.filter(
      (sb) => sb.fuel_type_code.toUpperCase() === fuelTypeCode,
    );
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Session expired — sign in again to load fuel pricing."
        : "Fuel pricing unavailable — try refreshing in a moment.";
  }

  const defaultRow =
    supplierBases.find((sb) => sb.is_default) ?? supplierBases[0] ?? null;
  const otherOptions = supplierBases.filter(
    (sb) => defaultRow && sb.id !== defaultRow.id,
  );

  return (
    <SectionPanel
      title="Fuel"
      titleAction={
        <span
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-yellow"
          title="Order workflow lands in M2-M-27b. Pricing + supplier directory shown today."
        >
          Pricing only · order workflow M2-M-27b
        </span>
      }
    >
      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </p>
      ) : supplierBases.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-3 py-4 text-xs text-muted-foreground">
          No supplier configured for{" "}
          <span className="font-mono font-semibold">{baseCode}</span> ·{" "}
          {fuelTypeCode}. Add one in Ground Ops → Fuel → Suppliers.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Fuel Type" hint={`auto · ${flight.aircraft.model}`}>
              <input
                type="text"
                disabled
                value={fuelTypeCode}
                className="ff-input cursor-not-allowed font-mono"
                title="Auto-selected from aircraft model. Change requires supervisor override (M3)."
              />
            </Field>
            <Field
              label="Supplier"
              hint={
                otherOptions.length > 0
                  ? `${otherOptions.length} alternate${otherOptions.length === 1 ? "" : "s"}`
                  : "only supplier"
              }
            >
              <select
                disabled
                defaultValue={defaultRow?.supplier_id ?? ""}
                key={`supplier-${flight.id}`}
                className="ff-input cursor-not-allowed"
              >
                {defaultRow && (
                  <option value={defaultRow.supplier_id}>
                    {defaultRow.supplier_name}
                  </option>
                )}
                {otherOptions.map((sb) => (
                  <option key={sb.id} value={sb.supplier_id}>
                    {sb.supplier_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Contract Price"
              hint={defaultRow?.is_contract_rate ? "contract" : "spot"}
            >
              <input
                type="text"
                disabled
                value={
                  defaultRow?.price_per_gallon !== null &&
                  defaultRow?.price_per_gallon !== undefined
                    ? `$${defaultRow.price_per_gallon.toFixed(2)} / gal`
                    : "—"
                }
                className="ff-input cursor-not-allowed font-mono"
              />
            </Field>
            <Field label="Gallons" hint="required">
              <input
                type="number"
                placeholder="e.g. 80"
                min={0}
                step={1}
                disabled
                className="ff-input cursor-not-allowed"
              />
            </Field>
            <Field label="Requested Time" hint="local">
              <input
                type="time"
                disabled
                className="ff-input cursor-not-allowed font-mono"
              />
            </Field>
            <Field label="Special Instructions" hint="optional">
              <input
                type="text"
                placeholder="e.g. north ramp"
                disabled
                className="ff-input cursor-not-allowed"
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.7rem] text-muted-foreground">
              Estimated cost auto-calculates from gallons × contract price
              once order entry is live (M2-M-27b).
            </p>
            <button
              type="button"
              disabled
              title="Order workflow ships in M2-M-27b (fuel_orders + supplier notification)"
              className="cursor-not-allowed rounded-md border border-status-blue bg-status-blue/15 px-4 py-2 text-xs font-semibold text-status-blue opacity-60"
            >
              Order Fuel · M2-M-27b
            </button>
          </div>
        </>
      )}
    </SectionPanel>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </label>
        {hint && (
          <span className="text-[0.6rem] text-muted-foreground/70">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Aircraft-model → fuel-type-code mapping. Mirrors the legacy
 * spec exactly:
 *   208 / 208B / King Air         → JET-A
 *   207 / GA8 / PA-31             → 100LL
 * Anything else (including null model, since flightops-services
 * migration 0023 made aircraft.model nullable) falls back to JET-A
 * (the legacy default for unknown turbine equipment).
 */
function fuelTypeForAircraft(model: string | null): string {
  if (!model) return "JET-A";
  const normalized = model.toUpperCase();
  if (/(207|GA[\s-]?8|PA[\s-]?31)/.test(normalized)) return "100LL";
  return "JET-A";
}
