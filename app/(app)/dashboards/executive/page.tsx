import Link from "next/link";
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Plane,
  XCircle,
} from "lucide-react";

import { StatCard } from "@/components/dashboards/stat-card";
import { Button } from "@/components/ui/button";
import { getFlightStats } from "@/lib/api/ops";
import { formatDate } from "@/lib/utils";

export default async function ExecutiveDashboardPage() {
  const stats = await getFlightStats();
  const fleetUtilization =
    stats.aircraft_total > 0
      ? Math.round((stats.aircraft_active / stats.aircraft_total) * 100)
      : 0;

  return (
    <main className="container py-10">
      <Link href="/dashboards" className="inline-block">
        <Button variant="ghost" size="sm" className="mb-4 -ml-3">
          <ChevronLeft className="h-4 w-4" />
          Dashboards
        </Button>
      </Link>

      <header className="mb-8 space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <Briefcase className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Insights
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Executive</h1>
        <p className="text-sm text-muted-foreground">
          Snapshot for the last 7 days (UTC).
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Flights today"
          value={stats.today.total}
          hint={`${stats.today.released} released · ${stats.today.scheduled} scheduled`}
          icon={<Plane className="h-5 w-5" />}
        />
        <StatCard
          label="Released this week"
          value={stats.this_week.released}
          hint={`of ${stats.this_week.total} planned`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Cancelled this week"
          value={stats.this_week.cancelled}
          hint={
            stats.this_week.total > 0
              ? `${Math.round((stats.this_week.cancelled / stats.this_week.total) * 100)}% of plan`
              : "—"
          }
          icon={<XCircle className="h-5 w-5" />}
          tone={stats.this_week.cancelled > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Fleet utilization"
          value={`${fleetUtilization}%`}
          hint={`${stats.aircraft_active} of ${stats.aircraft_total} aircraft active`}
          icon={<Plane className="h-5 w-5" />}
          tone={fleetUtilization >= 80 ? "success" : fleetUtilization >= 50 ? "default" : "warning"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">This week breakdown</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Scheduled" value={stats.this_week.scheduled} />
            <Row label="Released" value={stats.this_week.released} tone="success" />
            <Row label="Cancelled" value={stats.this_week.cancelled} tone="destructive" />
            <Row label="Completed" value={stats.this_week.completed} />
            <Row label="Total" value={stats.this_week.total} bold />
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Last release</h2>
          {stats.last_release_at ? (
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <time dateTime={stats.last_release_at} className="font-mono">
                {formatDate(stats.last_release_at)}
              </time>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No releases yet. Head to{" "}
              <Link href="/dispatch" className="underline">
                Dispatch
              </Link>{" "}
              to release your first flight.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: number;
  bold?: boolean;
  tone?: "success" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-green-500"
      : tone === "destructive"
        ? "text-destructive"
        : undefined;
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold" : ""} ${toneClass ?? ""}`}>
        {value}
      </dd>
    </div>
  );
}
