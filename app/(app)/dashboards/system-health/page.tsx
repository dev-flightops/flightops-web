import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CloudSun,
  type LucideIcon,
  Radio,
  Settings as SettingsIcon,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { getCompanyProfile } from "@/lib/api/auth";
import { PLATFORM_SERVICES, healthPath } from "@/lib/platform-services";
import { listFlights } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";

import packageJson from "@/package.json" with { type: "json" };

export const dynamic = "force-dynamic";

const GATEWAY_TIMEOUT_MS = 1500;
// The list lives in lib/platform-services.ts so it can be checked
// by a test — this page reaches apiFetch, so nothing could import it
// from here, which is how it came to name six of sixteen services.

interface CheckResult {
  ok: boolean;
  detail: string;
}

async function pingPath(path: string): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
    const res = await fetch(`${base}${path}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function checkGateway(): Promise<CheckResult> {
  const ok = await pingPath("/health");
  return ok
    ? { ok: true, detail: "Gateway responding normally" }
    : { ok: false, detail: "Gateway unreachable" };
}

async function checkServices(): Promise<{
  okCount: number;
  total: number;
  failing: string[];
}> {
  const results = await Promise.all(
    PLATFORM_SERVICES.map(async (svc) => ({
      svc,
      ok: await pingPath(healthPath(svc)),
    })),
  );
  const failing = results.filter((r) => !r.ok).map((r) => r.svc);
  return { okCount: results.length - failing.length, total: results.length, failing };
}

export default async function SystemHealthDashboardPage() {
  const [gateway, services, snapshot, recentReleased, companyProfile] =
    await Promise.all([
      checkGateway(),
      checkServices(),
      loadOperationalSnapshot().catch(() => null),
      // Most recently released flight stands in for "Last Dispatch
      // Packet" — release is the moment the dispatch packet locks in
      // our schema.
      listFlights({ status: "released", limit: 1 })
        .catch(() => null),
      getCompanyProfile().catch(() => null),
    ]);

  // AI / Compliance Engine — we don't ship an LLM in M2. Honest INFO
  // state until risk-analytics + compliance services land in M3.
  const aiKeyConfigured = Boolean(
    process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  );

  const lastPacket = recentReleased?.items[0];
  const cards: Array<{
    title: string;
    state: "ok" | "info" | "error";
    detail: string;
  }> = [
    {
      title: "Last Dispatch Packet",
      state: lastPacket ? "ok" : "info",
      detail: lastPacket
        ? `${lastPacket.flight_number} · ${lastPacket.origin} → ${lastPacket.destination} · released ${formatTime(lastPacket.scheduled_departure_at)}`
        : "No dispatch packets on record",
    },
    {
      title: "Database",
      state: gateway.ok ? "ok" : "error",
      detail: gateway.ok
        ? "Postgres responding via gateway"
        : "Gateway unreachable — DB check failed",
    },
    {
      title: "AI / Compliance Engine",
      state: aiKeyConfigured ? "ok" : "info",
      // "Not configured" is about THIS environment's key, and stays.
      // What went was "ship with M3": the ai-service shipped, and the
      // five AI tools are in the nav. Telling an operator that a
      // feature they can click on is coming in a past milestone is the
      // same overclaim in reverse.
      detail: aiKeyConfigured
        ? "API key configured"
        : "No API key set for this environment — the AI tools will not answer",
    },
    {
      title: "Active Flights",
      state: "ok",
      detail: snapshot
        ? `${snapshot.board.length} flight${snapshot.board.length === 1 ? "" : "s"} currently tracked`
        : "Board snapshot unavailable",
    },
    {
      // Titled "Enabled Modules" until now, which is a different thing
      // entirely: this card is the result of probing every service's
      // /health. Two services down rendered as "Enabled Modules: ERROR",
      // which reads as a licensing problem on the one page somebody
      // opens during an outage.
      //
      // The healthy branch also dropped the denominator — "16 modules
      // active" cannot be told apart from 16 of a longer list, which is
      // exactly the state this page was in when it silently checked six
      // of sixteen. Both branches now show n/total.
      title: "Backend Services",
      state: services.failing.length === 0 ? "ok" : "error",
      detail:
        services.failing.length === 0
          ? `${services.okCount}/${services.total} responding`
          : `${services.okCount}/${services.total} responding · failing: ${services.failing.join(", ")}`,
    },
    {
      title: "PDF Cache",
      state: "info",
      // Packet rendering shipped — /api/dispatch/{id}/release.pdf
      // serves it. Nothing is cached because it renders on demand,
      // which is a design choice rather than a missing feature, so the
      // card says that instead of naming a milestone that has passed.
      detail: "Dispatch packets render on demand; nothing is cached",
    },
  ];

  const allOk = cards.every((c) => c.state === "ok" || c.state === "info");
  const degradedCount = cards.filter((c) => c.state === "error").length;

  const asOf = new Date().toISOString().slice(11, 19);

  return (
    <div className="container py-6">
      <DashboardNav active="system-health" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">System Health</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            As of <span className="font-mono">{asOf}</span> UTC
          </p>
        </div>
        <OverallStatusPill ok={allOk} degraded={degradedCount} />
      </div>

      {/* Service status cards */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          {cards.map((c) => (
            <StatusCard key={c.title} {...c} />
          ))}
        </div>
      </section>

      {/* Quick navigation */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Quick Navigation
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUICK_NAV.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.href}
                href={q.href}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background/40 p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
              >
                <Icon
                  className="h-6 w-6 text-primary/80"
                  aria-hidden
                  strokeWidth={1.5}
                />
                <span className="text-xs font-medium text-foreground">
                  {q.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Platform metadata footer */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground">
        <dl className="space-y-1.5">
          <Meta
            label="Platform"
            value={
              companyProfile?.short_name ??
              companyProfile?.legal_name ??
              "FlightOps"
            }
          />
          <Meta label="Type" value="Part 135 Air Taxi & On-Demand" />
          {/* No milestone suffix. This said "M2 build" through all of
              M3 and most of M4, because a hand-maintained label next to
              a generated version number only ever drifts one way.
              package.json is the version; nothing else claims to be. */}
          <Meta label="App version" value={`v${packageJson.version}`} />
          <Meta
            label="Refresh"
            value="This page reflects a point-in-time snapshot. Reload to refresh."
          />
        </dl>
      </section>

      {/* Says what is absent, without naming a milestone. "Ships with
          M4" was written during M2; read during M4 it promises the
          reader something the page they are looking at does not have. */}
      <p className="mt-4 text-center text-[0.65rem] text-muted-foreground/60">
        Deeper observability — request latency p50/p95/p99, deploy history, job
        queue depth, and per-route error rates — is not built.
      </p>
    </div>
  );
}

function OverallStatusPill({
  ok,
  degraded,
}: {
  ok: boolean;
  degraded: number;
}) {
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-status-green/30 bg-status-green/10 px-3 py-1 text-xs font-semibold text-status-green">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        All Systems OK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-status-red/30 bg-status-red/10 px-3 py-1 text-xs font-semibold text-status-red">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
      {degraded} Degraded
    </span>
  );
}

function StatusCard({
  title,
  state,
  detail,
}: {
  title: string;
  state: "ok" | "info" | "error";
  detail: string;
}) {
  const badge =
    state === "ok" ? (
      <span className="rounded bg-status-green/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-status-green">
        OK
      </span>
    ) : state === "info" ? (
      <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
        INFO
      </span>
    ) : (
      <span className="rounded bg-status-red/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-status-red">
        ERROR
      </span>
    );

  const borderTone =
    state === "ok"
      ? "border-l-status-green/60"
      : state === "info"
        ? "border-l-status-blue/40"
        : "border-l-status-red/60";

  return (
    <div
      className={`rounded border-l-4 ${borderTone} bg-background/40 px-4 py-3`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {badge}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="font-semibold text-foreground/80">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatTime(iso: string): string {
  return iso.slice(11, 16) + "Z";
}

// Quick Navigation grid — mirrors legacy's six-cell layout, mapped to
// our actual routes (we don't have a Recognition module yet; Settings
// is the closest analogue for the admin shelf, and Schedule replaces
// the "Crew" cell since /crew is M3). Icons come from lucide-react
// because emoji glyphs fall back to missing-glyph boxes on systems
// without an emoji font installed.
const QUICK_NAV: {
  label: string;
  icon: LucideIcon;
  href: string;
}[] = [
  { label: "Dispatch", icon: ClipboardList, href: "/dispatch" },
  { label: "Flight Following", icon: Radio, href: "/flight-following" },
  { label: "Maintenance", icon: Wrench, href: "/maintenance" },
  { label: "Schedule", icon: Calendar, href: "/schedule" },
  { label: "Weather", icon: CloudSun, href: "/weather" },
  { label: "Settings", icon: SettingsIcon, href: "/settings" },
];
