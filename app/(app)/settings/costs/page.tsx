import Link from "next/link";

/**
 * /settings/costs — legacy `templates/settings/costs.html`.
 *
 * Aircraft Operating Cost Configuration. Sections:
 *   1. Aircraft Type Costs table (Fuel GPH · Engine/Prop/Mx Reserves ·
 *      Oil · Pilot $/day · Duty Hrs · Pilot $/hr · Cost/hr *)
 *      + "Add / Edit Aircraft Type" details form
 *   2. Fuel Prices by Base ($/gal grid) + Add Fuel Price form
 *   3. Landing Fees (2-col grid) + Route Flight Times (2-col grid)
 *   4. Cost Per Flight Hour Calculator (aircraft × base matrix,
 *      only rendered when both above sections have data)
 *
 * Feeds Dispatch AI Intelligence card costs. Marc's M2 backend
 * still to land — all CTAs disabled with milestone tooltips.
 */

const BACKEND_HINT =
  "Operating cost configuration ships with the settings-service (M2 backend)";

export default function SettingsCostsPage() {
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
              <tbody>
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No aircraft types configured. Add one below.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          * Cost/hr excludes fuel — fuel varies by base. Total = fuel (GPH ×
          base price) + reserves + crew.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-status-blue">+ Add / Edit Aircraft Type</summary>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
            ].map((f) => (
              <label key={f.label}>
                <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {f.label}
                </span>
                <input
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  disabled
                  title={BACKEND_HINT}
                  className="w-full cursor-not-allowed rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-100"
                />
              </label>
            ))}
            <div className="flex items-end">
              <button
                type="button"
                disabled
                aria-disabled="true"
                title={BACKEND_HINT}
                className="w-full cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-100"
              >
                Save
              </button>
            </div>
          </div>
        </details>
      </section>

      <section className="mb-5 rounded-lg border border-border bg-card px-4 py-4">
        <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Fuel Prices by Base ($/gal)
        </div>
        <p className="text-sm text-muted-foreground">
          No fuel prices configured. Add one below.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-status-blue">+ Add / Edit Fuel Price</summary>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="w-20">
              <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                ICAO
              </span>
              <input
                type="text"
                placeholder="PABE"
                disabled
                title={BACKEND_HINT}
                className="w-full cursor-not-allowed rounded-md border border-border bg-background px-2 py-1.5 text-sm uppercase disabled:opacity-100"
              />
            </label>
            <label className="w-24">
              <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                $/gal
              </span>
              <input
                type="number"
                placeholder="7.50"
                disabled
                title={BACKEND_HINT}
                className="w-full cursor-not-allowed rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-100"
              />
            </label>
            <label className="w-28">
              <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Type
              </span>
              <select
                disabled
                title={BACKEND_HINT}
                className="w-full cursor-not-allowed rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-100"
              >
                <option>100LL</option>
                <option>Jet-A</option>
              </select>
            </label>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={BACKEND_HINT}
              className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-100"
            >
              Save
            </button>
          </div>
        </details>
      </section>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Landing Fees
          </div>
          <p className="text-sm text-muted-foreground">
            No landing fees configured. Add one below.
          </p>
        </section>
        <section className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Route Flight Times
          </div>
          <p className="text-sm text-muted-foreground">
            No route flight times configured. Add one below.
          </p>
        </section>
      </div>

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
    </div>
  );
}
