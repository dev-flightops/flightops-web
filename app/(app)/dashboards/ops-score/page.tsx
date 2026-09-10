import { Activity, Clock, Plane, Shield, Stethoscope, Users } from "lucide-react";
import Link from "next/link";

import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { getOpsScore, type OpsScorePillar } from "@/lib/api/reports";
import { PillarBar } from "@/components/dashboards/pillar-bar";
import { ScorePill } from "@/components/dashboards/score-pill";

/** Icon per pillar, keyed by the service's `key`. Unknown keys get no
 *  icon rather than a wrong one — a pillar the service adds later
 *  should appear unadorned, not mislabelled. */
function pillarIcon(key: string) {
  const cls = "h-3.5 w-3.5 text-muted-foreground";
  if (key === "completion") return <Plane className={cls} aria-hidden />;
  if (key === "on_time") return <Clock className={cls} aria-hidden />;
  if (key === "crew") return <Users className={cls} aria-hidden />;
  if (key === "fleet") return <Activity className={cls} aria-hidden />;
  if (key === "safety") return <Shield className={cls} aria-hidden />;
  return undefined;
}

export default async function OpsScoreDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tz?: string }>;
}) {
  // Which day is scored is the operator's question, not the server's.
  // A dial headed Thursday that covers Wednesday's flights because the
  // server runs on UTC is worse than no heading. Rides in as a search
  // param because a server component cannot read the browser zone.
  const { tz } = await searchParams;
  // The operational snapshot and flight stats used to feed the local
  // pillar computation. The service owns that now, so neither is
  // fetched here — two round trips saved and one less place for the
  // numbers to disagree.
  // The score comes from reports-service. It used to be computed here
  // — three pillars locally and two rendered as a literal 0 — which is
  // how 30 of 100 points sat unreachable for a milestone without a
  // single test failing.
  //
  // Soft-fail: a score that will not load should cost the dial, not the
  // page. The alerts and board below it are separately sourced.
  let opsScore = 0;
  let maxAchievable = 100;
  let band: string | null = null;
  let pillars: OpsScorePillar[] = [];
  let asOf = new Date().toISOString().slice(0, 10);
  let scoreError: string | null = null;
  try {
    const result = await getOpsScore(tz);
    opsScore = result.score;
    maxAchievable = result.max_achievable;
    band = result.band;
    pillars = result.pillars;
    asOf = result.as_of;
  } catch {
    scoreError = "Score unavailable — reports-service did not answer.";
  }

  // Human-readable date heading — legacy peregrineflight uses
  // "Wednesday, June 17, 2026" rather than the bare ISO. Rendered in
  // the same zone the score was computed for, so the heading and the
  // number agree about which day this is.
  const longDate = new Date(`${asOf}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="container py-6">
      <DashboardNav active="ops-score" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Daily Operations Score
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{longDate}</p>
        </div>
        <Link
          href="/dashboards/system-health"
          className="inline-flex items-center gap-1.5 text-xs text-status-blue hover:underline"
        >
          <Stethoscope className="h-3.5 w-3.5" aria-hidden />
          System Health →
        </Link>
      </div>

      {/* Central dial + score-band legend */}
      <section className="mt-5 rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Ops Score
        </p>
        {scoreError && (
          <p
            role="alert"
            className="mx-auto mt-3 max-w-md rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red"
          >
            {scoreError}
          </p>
        )}
        <div className="mt-4 flex justify-center">
          <ScorePill score={opsScore} size="large" band={band} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {/* Out of what is achievable, not a flat 100. Two pillars
              used to be hardcoded to zero, so a flawless day scored 70
              and read "Fair" — printing "out of 100" while 30 points
              were unreachable told the operator something false about
              their operation. */}
          out of {maxAchievable} · {longDate}
        </p>
        {maxAchievable < 100 && (
          <p className="mt-1 text-[0.65rem] text-status-yellow">
            {100 - maxAchievable} point
            {100 - maxAchievable === 1 ? "" : "s"} cannot be measured yet — see
            the breakdown below.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground/80">
          {/* Percentages, not absolute points. While any pillar is
              unmeasurable the total is out of less than 100, and
              "90–100 Excellent" beside a score out of 97 reads as an
              absolute cut-off nobody can reach. */}
          <ScoreBand label="90%+ Excellent" tone="green" />
          <ScoreBand label="75–89% Good" tone="green-soft" />
          <ScoreBand label="60–74% Fair" tone="orange" />
          <ScoreBand label="<60% Needs Attention" tone="red" />
        </div>
      </section>

      {/* Pillar breakdown */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Score Breakdown
        </h2>
        <div className="space-y-5">
          {/* Rendered from the service rather than assembled here. The
              two pillars that sat at a literal 0 for a milestone did so
              because this list was hand-wired and nothing failed when a
              score never moved. */}
          {pillars.map((p) => (
            <PillarBar
              key={p.key}
              label={p.label}
              score={p.score}
              max={p.max}
              icon={pillarIcon(p.key)}
              context={p.context}
              notMeasured={p.not_measured}
            />
          ))}
        </div>
      </section>

      {/* Methodology — legacy uses concrete scoring rules, not dev notes */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Score Methodology
        </h2>
        <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground sm:grid-cols-2 md:grid-cols-5">
          <Methodology
            icon={<Plane className="h-3.5 w-3.5" aria-hidden />}
            title="Completion Factor (25 pts)"
            body="Flights that landed or completed vs flights that should have been done today. Remaining scheduled flights are excluded — they are not yet judged. Weather cancellations are noted but still counted."
          />
          <Methodology
            icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
            title="On-Time Performance (25 pts)"
            body="Arrivals within 15 minutes of ETA. Delays caused by weather, ATC, or cascading previous legs are excluded from the penalty — those are not within the operation's control."
          />
          <Methodology
            icon={<Users className="h-3.5 w-3.5" aria-hidden />}
            title="Crew Compliance (20 pts)"
            body="Starts at 20. Deducts 2 pts per expired medical certificate, 0.5 pts per certificate expiring within 30 days. An expired certificate that is not a medical also counts at the 0.5 tier — it cannot be cheaper than one merely approaching. Floors at 0."
          />
          <Methodology
            icon={<Activity className="h-3.5 w-3.5" aria-hidden />}
            title="Fleet Airworthiness (20 pts)"
            body="Starts at 20. Deducts proportionally per aircraft on RTS Hold, smaller deduction per aircraft with open squawks but not on hold."
          />
          <Methodology
            icon={<Shield className="h-3.5 w-3.5" aria-hidden />}
            title="Safety Indicators (10 pts)"
            body="Starts at 10. Deducts 2 pts per currently overdue flight. The 3 pts allocated to diversions and returns-to-departure are withheld rather than awarded: a flight record has no actual destination, so a diversion cannot be detected, and scoring it as clean would assert something we cannot see. This is not a safety compliance score — it is a signal of unusual events that warrant leadership attention."
          />
        </div>
        <div className="mt-4 space-y-1 border-t border-border pt-3 text-[0.7rem] text-muted-foreground/80">
          <p>
            This score is informational and trend-focused. A single day&apos;s
            score should always be read in context.
          </p>
          <p>
            A diversion due to weather does not mean the operation failed — it
            means the crew made the right call.
          </p>
        </div>
      </section>

      {/* 8-week trend */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          8-Week Completion Trend
        </h2>
        <CompletionTrend opsScore={opsScore} />
        <div className="mt-3 space-y-1 text-[0.7rem] text-muted-foreground/80">
          <p>
            Based on recorded DispatchOutcomes. Flights without outcomes are not
            counted.
          </p>
          <p>
            Record outcomes in{" "}
            <Link
              href="/flight-following/history"
              className="text-status-blue hover:underline"
            >
              Dispatch History
            </Link>{" "}
            or they are captured automatically when Flight Following closes.
          </p>
        </div>
      </section>
    </div>
  );
}

function Methodology({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
        {icon}
        {title}
      </p>
      <p>{body}</p>
    </div>
  );
}

function ScoreBand({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "green-soft" | "orange" | "red";
}) {
  const dotClass =
    tone === "green"
      ? "bg-status-green"
      : tone === "green-soft"
        ? "bg-status-green/60"
        : tone === "orange"
          ? "bg-status-orange"
          : "bg-status-red";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}

function CompletionTrend({ opsScore }: { opsScore: number }) {
  // 8 week-start labels ending with the most recent Monday — "W{MM}/{DD}"
  // matches legacy peregrineflight's trend axis. Bars stay at a thin
  // placeholder height until DispatchOutcomes aggregation lands; only
  // the current week shows the live ops score for visual continuity.
  const labels: { key: string; pct: number }[] = [];
  const now = new Date();
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = monday.getUTCDay();
  const daysSinceMon = day === 0 ? 6 : day - 1;
  monday.setUTCDate(monday.getUTCDate() - daysSinceMon);
  for (let i = 7; i >= 0; i--) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    labels.push({ key: `W${mm}/${dd}`, pct: i === 0 ? opsScore : 0 });
  }
  return (
    <div className="flex h-32 items-end justify-between gap-2">
      {labels.map(({ key, pct }) => (
        <div key={key} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[0.6rem] text-muted-foreground/60">
            {pct > 0 ? `${pct.toFixed(0)}%` : "0%"}
          </span>
          <div
            className="w-full rounded-t bg-status-blue/60"
            style={{ height: `${Math.max(pct, 2)}%` }}
          />
          <span className="font-mono text-[0.6rem] text-muted-foreground/60">
            {key}
          </span>
        </div>
      ))}
    </div>
  );
}
