import type { LegLoad } from "@/lib/api/manifest";
import { cn } from "@/lib/utils";

const TH = "px-3 py-2.5 font-semibold";
const THEAD =
  "border-b border-border bg-muted/60 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground";

function fmtLbs(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

/**
 * A multi-stop flight's legs, each with its own load (LOG-40): who and what
 * is aboard, the fuel it leaves with (the fuel at departure less what the
 * legs before it burn) and what is left. Shown on the manifest, the
 * dispatch packet and the pilot's weight and balance. The client, 18 Nov:
 * "If I leave PABE with 1200 LBS, deduct fuel burn to PAMO. I should have a
 * greater useful load leaving PAMO back to PABE"; the packet and the pilot
 * had shown only the tightest leg.
 */
export function LegLoadPanel({
  legs,
  burned,
  className = "mb-6 rounded-lg bg-card",
}: {
  legs: LegLoad[];
  burned: boolean;
  className?: string;
}) {
  return (
    <section aria-label="Load by leg" className={cn("overflow-hidden border border-border", className)}>
      <h2 className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Load by leg
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Leg</th>
              <th className={`${TH} text-right`}>Passengers</th>
              <th className={`${TH} text-right`}>Pax &amp; bags</th>
              <th className={`${TH} text-right`}>Cargo</th>
              <th className={`${TH} text-right`}>Mail</th>
              <th className={`${TH} text-right`}>Fuel</th>
              <th className={`${TH} text-right`}>Left for mail &amp; freight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {legs.map((leg, i) => {
              const left = leg.remaining_lbs == null ? null : Number(leg.remaining_lbs);
              return (
                <tr key={`${i}-${leg.origin}-${leg.destination}`}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                    {`${i + 1}  ${leg.origin} → ${leg.destination}`}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{leg.pax_count}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                    {fmtLbs(Number(leg.pax_weight_lbs) + Number(leg.baggage_lbs))}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtLbs(leg.cargo_lbs)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtLbs(leg.mail_lbs)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                    {leg.fuel_lbs == null ? "—" : fmtLbs(leg.fuel_lbs)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${
                      left != null && left < 0 ? "font-semibold text-status-red" : ""
                    }`}
                  >
                    {left == null ? "—" : left < 0 ? `${fmtLbs(-left)} over` : fmtLbs(left)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {burned
          ? "Fuel is what each leg leaves with: the fuel at departure less what the legs before it burn."
          : "Each leg is counted with the first leg’s fuel: set the aircraft’s fuel burn (Settings → Fleet) to count what’s burned between stops."}
      </p>
    </section>
  );
}
