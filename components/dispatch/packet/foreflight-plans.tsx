import Link from "next/link";

import type { ExternalPlan, FlightPlans, PlanMatch, ToolPlan } from "@/lib/api/integrations";

import { SectionPanel } from "./section-panel";

/**
 * The pilot's plan from ForeFlight (#55) on the flight it belongs to,
 * beside Peregrine's own weight and balance check.
 *
 * Peregrine's check stays the record (decided 6 Oct): ForeFlight's
 * verdict is shown, never used for release or preflight. When the two
 * disagree the plan says so in red, because a pilot flying on one load
 * and a release made on another is what this page is here to catch.
 */

const MATCH_LABEL: Partial<Record<PlanMatch, string>> = {
  linked: "Sent from Peregrine",
  matched: "Matched by tail and time",
  assigned: "Placed by dispatch",
};

const DOCUMENTS = [
  ["navlog", "Navlog"],
  ["briefing", "Briefing"],
  ["wb", "W&B report"],
] as const;

const EYEBROW = "text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground";

const OURS = {
  within: { text: "Within limits: the PIC confirmed it at preflight.", tone: "text-status-green" },
  over: {
    text: "Over: handed back to dispatch, and preflight is held until the load is re-planned.",
    tone: "text-status-red",
  },
  none: { text: "Not checked yet: the PIC confirms it at preflight step 2.", tone: "text-muted-foreground" },
} as const;

function zulu(iso: string | null): string {
  return iso ? `${iso.slice(0, 16).replace("T", " ")}Z` : "—";
}

function duration(minutes: number | null): string {
  if (minutes === null) return "—";
  const whole = Math.round(minutes);
  return `${Math.floor(whole / 60)}h ${String(whole % 60).padStart(2, "0")}m`;
}

function amount(n: number | null, digits = 0): string {
  return n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function Fuel({ plan }: { plan: ToolPlan }) {
  const parts = (
    [
      ["total", plan.fuel.total],
      ["to destination", plan.fuel.to_destination],
      ["reserve", plan.fuel.reserve],
      ["alternate", plan.fuel.alternate],
      ["landing", plan.fuel.landing],
    ] as const
  ).filter(([, n]) => n !== null);
  if (parts.length === 0) return null;
  return (
    <p className="mt-1 text-xs">
      <span className="text-muted-foreground">{`Fuel (${plan.fuel.unit ?? plan.weight_unit}) `}</span>
      <span className="tabular-nums">{parts.map(([label, n]) => `${label} ${amount(n)}`).join(" · ")}</span>
    </p>
  );
}

function TheirWeightAndBalance({ plan }: { plan: ToolPlan }) {
  if (plan.within_limits === null) {
    return <p className="mt-1 text-xs text-muted-foreground">ForeFlight has no weight and balance for this leg yet.</p>;
  }
  return (
    <>
      <table className="mt-1 w-full text-left text-xs tabular-nums">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-0.5 pr-3 font-semibold">Point</th>
            <th className="py-0.5 pr-3 font-semibold">ForeFlight</th>
            <th className="py-0.5 font-semibold">Limit</th>
          </tr>
        </thead>
        <tbody>
          {plan.weights.map((w) => (
            <tr key={`w-${w.point}`} className="border-t border-border">
              <td className="py-0.5 pr-3">{`${w.point} weight`}</td>
              <td className="py-0.5 pr-3">{`${amount(w.weight)} ${plan.weight_unit}`}</td>
              <td className="py-0.5">{w.max === null ? "—" : `max ${amount(w.max)}`}</td>
            </tr>
          ))}
          {plan.cg.map((c) => (
            <tr key={`cg-${c.point}`} className="border-t border-border">
              <td className="py-0.5 pr-3">{`${c.point} CG`}</td>
              <td className="py-0.5 pr-3">{`${amount(c.cg, 2)} ${plan.cg_unit}`.trim()}</td>
              <td className="py-0.5">{`${amount(c.fwd, 2)} to ${amount(c.aft, 2)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {plan.within_limits ? (
        <p className="mt-1 text-xs text-status-green">Within every limit ForeFlight has.</p>
      ) : (
        <div className="mt-1 text-xs text-status-red">
          <p className="font-semibold">Outside ForeFlight&rsquo;s limits:</p>
          <ul className="list-disc pl-4">
            {plan.limit_issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function PlanCard({ plan, disagrees }: { plan: ExternalPlan; disagrees: boolean }) {
  const p = plan.plan;
  const heading = [
    plan.leg_sequence ? `Leg ${plan.leg_sequence}` : null,
    `${p.departure} → ${p.destination}`,
    p.tail,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <article aria-label={`ForeFlight plan: ${heading}`} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      {disagrees && (
        <p
          role="alert"
          className="mb-2 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          ForeFlight&rsquo;s weight and balance disagrees with Peregrine&rsquo;s. Peregrine&rsquo;s check is the
          record: find out which load is right before this flight goes.
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{heading}</p>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {MATCH_LABEL[plan.match] ?? plan.match}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Departs</dt>
          <dd className="tabular-nums">{zulu(p.departs_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Arrives</dt>
          <dd className="tabular-nums">{zulu(p.arrives_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">En route</dt>
          <dd className="tabular-nums">{duration(p.ete_minutes)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rules</dt>
          <dd>{p.flight_rule ?? "—"}</dd>
        </div>
      </dl>
      {p.route && (
        <p className="mt-1 text-xs">
          <span className="text-muted-foreground">Route </span>
          <span className="font-mono">{p.route}</span>
        </p>
      )}
      {p.alternates.length > 0 && (
        <p className="mt-1 text-xs">
          <span className="text-muted-foreground">Alternates </span>
          {p.alternates.join(", ")}
        </p>
      )}
      <Fuel plan={p} />
      <div className="mt-2">
        <p className={EYEBROW}>ForeFlight weight and balance</p>
        <TheirWeightAndBalance plan={p} />
      </div>
      {(p.released || (p.filing_status && p.filing_status !== "None")) && (
        <p className="mt-2 text-xs">
          {[p.released ? "Released in ForeFlight" : null, p.filing_status && p.filing_status !== "None" ? `Filing: ${p.filing_status}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {p.warnings.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-xs text-status-yellow">
          {p.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 flex flex-wrap items-baseline gap-3 text-xs">
        {DOCUMENTS.map(([kind, label]) => (
          <a
            key={kind}
            href={`/api/foreflight/plans/${plan.id}/documents/${kind}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            {label}
          </a>
        ))}
        <span className="text-muted-foreground">
          {`Fetched ${zulu(plan.fetched_at)}${p.account ? ` from ${p.account}` : ""}`}
        </span>
      </p>
    </article>
  );
}

export function ForeFlightPlans({ data }: { data: FlightPlans }) {
  if (data.plans.length === 0 && !data.bringing_plans) return null;
  const ours = OURS[data.our_weight_and_balance ?? "none"];
  const disagreements = new Set(data.disagreements);
  return (
    <SectionPanel title={data.plans.length > 1 ? "ForeFlight plans" : "ForeFlight plan"}>
      <p className="text-xs">
        <span className="font-semibold">Peregrine&rsquo;s weight and balance, the record: </span>
        <span className={ours.tone}>{ours.text}</span>
      </p>
      {data.plans.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No plan from ForeFlight for this flight yet. Pilots&rsquo; plans come back every five minutes.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {data.plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} disagrees={disagreements.has(plan.id)} />
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

/**
 * ForeFlight plans no single leg fits, waiting to be placed (#55).
 * Above the packet like the bookings awaiting a flight, and amber for
 * the same reason: behind, not blocked. Nothing when none wait.
 */
export function ForeFlightPlansWaitingBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <section
      aria-label="ForeFlight plans waiting for a flight"
      className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5"
    >
      <p className="text-xs">
        <span className="font-semibold uppercase tracking-[0.06em] text-status-yellow">ForeFlight plans</span>
        <span className="ml-2 text-muted-foreground">
          {`${count} ${count === 1 ? "plan pilots made in ForeFlight fits" : "plans pilots made in ForeFlight fit"} no single leg here.`}
        </span>
      </p>
      <Link href="/dispatch/foreflight-plans" className="text-xs font-semibold text-primary hover:underline">
        Place them
      </Link>
    </section>
  );
}
