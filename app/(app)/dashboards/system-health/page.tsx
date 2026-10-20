import Link from "next/link";

import { PageHeader } from "@/components/ff/page-header";
import { linkCaps } from "@/components/ff/controls";
import { StatusMark } from "@/components/ff/status-mark";
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

      <PageHeader
        title="System Health"
        description={
          <>
            As of <span className="font-mono">{asOf}</span> UTC
          </>
        }
        actions={<OverallStatusPill ok={allOk} degraded={degradedCount} />}
      />

      {/* Service status cards */}
      <section className="mt-5 rounded-lg border border-border bg-card p-5">
        <div className="space-y-2">
          {cards.map((c) => (
            <StatusCard key={c.title} {...c} />
          ))}
        </div>
      </section>

      {/* Quick navigation */}
      <section className="mt-5 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 panel-title">
          Quick Navigation
        </h2>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {QUICK_NAV.map((q) => (
            <Link key={q.href} href={q.href} className={linkCaps}>
              {q.label} <span aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Platform metadata footer */}
      <section className="mt-5 rounded-lg border border-border bg-card p-5 text-xs text-muted-foreground">
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
      <p className="mt-4 text-center text-[0.65rem] text-muted-foreground">
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
  // The overall state as a status mark (#82), not a tinted pill.
  if (ok) return <StatusMark label="All Systems OK" tone="green" className="text-xs" />;
  return <StatusMark label={`${degraded} Degraded`} tone="red" className="text-xs" />;
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
      <span className="status-mark text-status-green">
        OK
      </span>
    ) : state === "info" ? (
      <span className="status-mark text-status-blue">
        INFO
      </span>
    ) : (
      <span className="status-mark text-status-red">
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
      className={`rounded-sm border-l-[3px] ${borderTone} bg-muted/60 px-4 py-3`}
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

// Quick navigation — legacy's six destinations, mapped to our routes (no
// Recognition module yet; Settings is the closest analogue for the admin
// shelf, and Schedule replaces the "Crew" cell). As words since #79: the
// brief rules out stock icon sets.
const QUICK_NAV: { label: string; href: string }[] = [
  { label: "Dispatch", href: "/dispatch" },
  { label: "Flight Following", href: "/flight-following" },
  { label: "Maintenance", href: "/maintenance" },
  { label: "Schedule", href: "/schedule" },
  { label: "Weather", href: "/weather" },
  { label: "Settings", href: "/settings" },
];
