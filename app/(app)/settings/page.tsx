import Link from "next/link";

import { ChevronRightGlyph } from "@/components/ff/glyphs";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { Stat, StatStrip } from "@/components/ff/stat-strip";
import { ApiError } from "@/lib/api/client";
import {
  getCompanyProfile,
  getFlightTrackingConfig,
  listCompanyBases,
  listSsoProviders,
  listUsers,
} from "@/lib/api/auth";
import { listAircraft } from "@/lib/api/ops";
import { aircraftGaps } from "@/lib/setup/aircraft";

/**
 * /settings — Settings landing.
 *
 * Every company setting, grouped, with where each one stands now.
 *
 * The Users count soft-falls back to "—" when the caller isn't
 * exec_admin — the rest of the landing is readable by any role, but the
 * /settings/users endpoint requires exec_admin. We don't want a 403 to
 * blank the whole page.
 */
export default async function SettingsLandingPage() {
  let companyName: string | null = null;
  let basesCount = 0;
  let overdueMinutes: number | null = null;
  let simMode: boolean | null = null;
  let usersTotal: number | null = null;
  let activeAircraft = 0;
  // #138: active aircraft missing what a flight on them needs.
  let aircraftNeedingSetup = 0;
  let loadError: string | null = null;

  try {
    const [company, bases, tracking] = await Promise.all([
      getCompanyProfile(),
      listCompanyBases(),
      getFlightTrackingConfig(),
    ]);
    companyName = company.short_name ?? company.legal_name;
    basesCount = bases.total;
    overdueMinutes = tracking.overdue_threshold_minutes;
    simMode = tracking.simulation_mode_enabled;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Settings data unavailable. Try refreshing in a moment.";
  }

  try {
    const active = (await listAircraft()).items.filter((a) => a.is_active);
    activeAircraft = active.length;
    aircraftNeedingSetup = active.filter((a) => aircraftGaps(a).length > 0).length;
  } catch {
    // Non-fatal — leave the tile at 0 if the fleet endpoint is unreachable.
  }

  try {
    const users = await listUsers();
    usersTotal = users.total;
  } catch {
    // 403 (not exec_admin) is the expected path for non-admins; leave
    // the tile blank rather than blocking the whole landing.
  }

  let ssoConnected = 0;
  try {
    const sso = await listSsoProviders();
    ssoConnected = sso.items.filter((p) => p.is_active && p.has_secret).length;
  } catch {
    // Same fall-through as listUsers — non-admins shouldn't see the
    // SSO sublabel either way.
  }

  // A settings list (#86), as ForeFlight lays its own out: groups under
  // caps heads, one row per page with what it is and where it stands
  // now, instead of a grid of cards. Every Settings page in the
  // department nav has its row.
  const sections: { title: string; rows: SettingsRow[] }[] = [
    {
      title: "Company",
      rows: [
        {
          label: "Company Profile",
          blurb: "Legal name, address, contacts, Part 135 certificate.",
          value: companyName ?? "Not configured",
          href: "/settings/company",
        },
        {
          label: "Brand Theme",
          blurb: "Your brand colors on buttons, links and accents in every module.",
          value: "Primary + hover colors",
          href: "/settings/branding",
        },
        {
          label: "Billing",
          blurb: "Plan, seats, billing dates and invoices.",
          href: "/settings/billing",
        },
      ],
    },
    {
      title: "Operations",
      rows: [
        {
          label: "Bases",
          blurb: "The ICAOs the operator works out of. Hub and active flags drive what other modules show.",
          value: `${basesCount} active`,
          href: "/settings/bases",
        },
        {
          label: "Fleet",
          blurb: "Add, edit and retire aircraft. Passenger seats and useful load feed the Fleet Board and load planning.",
          value:
            aircraftNeedingSetup > 0
              ? `${activeAircraft} active · ${aircraftNeedingSetup} need${aircraftNeedingSetup === 1 ? "s" : ""} setup`
              : `${activeAircraft} active`,
          href: "/settings/fleet",
        },
        {
          label: "Flight Tracking",
          blurb: "Overdue threshold, polling cadence, simulation mode, Spider Tracks AFF.",
          value: overdueMinutes === null ? "—" : `${overdueMinutes}-min overdue alert`,
          href: "/settings/flight-tracking",
        },
        {
          label: "Flight Risk",
          blurb: "Where Low, Medium, High and Extreme begin on the pre-flight risk assessment.",
          href: "/settings/frat",
        },
        {
          label: "Check-in",
          blurb: "What gate check-in must capture, no-show fees, standby and walk-ups, and your own fields.",
          href: "/settings/check-in",
        },
        {
          label: "Load Teams",
          blurb: "Ramp and load crew teams by base.",
          href: "/settings/load-teams",
        },
        {
          label: "Costs",
          blurb: "Aircraft operating costs behind the cost figures in Dispatch AI Intelligence.",
          href: "/settings/costs",
        },
      ],
    },
    {
      title: "People",
      rows: [
        {
          label: "Users",
          blurb: "Invite users and assign their roles.",
          value: usersTotal === null ? "—" : `${usersTotal} total`,
          href: "/settings/users",
        },
        {
          label: "Permissions",
          blurb: "The role catalog and what each role may do.",
          href: "/settings/permissions",
        },
        {
          label: "Document requirements",
          blurb: "What staff must file.",
          href: "/settings/document-requirements",
        },
        {
          label: "Pilot Pay",
          blurb: "Pay rates and per diem.",
          href: "/settings/pilot-pay",
        },
        {
          label: "Currency Items",
          blurb: "The currency catalog and its due-date rules.",
          href: "/settings/currency",
        },
      ],
    },
    {
      title: "Integrations",
      rows: [
        {
          label: "SSO Providers",
          blurb: "Sign-in through Google, Okta or Entra ID.",
          value: ssoConnected === 0 ? "None connected" : `${ssoConnected} active`,
          href: "/settings/sso",
        },
        {
          label: "ForeFlight",
          blurb: "Send scheduled flights to ForeFlight Dispatch.",
          href: "/settings/foreflight",
        },
        {
          label: "Text Messages",
          blurb: "Text passengers waiting for a seat a no-show opened, from the company's Twilio account.",
          href: "/settings/text-messages",
        },
        {
          label: "API Keys",
          blurb: "Issue, review and revoke keys for partner access to the read-only Public API.",
          href: "/settings/api-keys",
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={companyName ?? undefined}
        title="Settings"
        description="Company-wide configuration: company identity, bases, flight tracking, users and integrations"
      />

      {loadError && (
        <Notice tone="yellow" role="alert" className="mb-4">
          {loadError}
        </Notice>
      )}

      <StatStrip label="Settings at a glance">
        <Stat value={basesCount} label="Bases" />
        <Stat value={activeAircraft} label="Active aircraft" />
        <Stat
          value={overdueMinutes === null ? "—" : `${overdueMinutes} min`}
          label="Overdue threshold"
        />
        <Stat
          value={simMode === null ? "—" : simMode ? "Simulation" : "Live"}
          label="Tracking"
          tone={simMode ? "yellow" : "neutral"}
        />
      </StatStrip>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <Panel key={section.title} title={section.title} flush>
            <ul className="divide-y divide-border">
              {section.rows.map((row) => (
                <li key={row.href}>
                  <SettingsLink row={row} />
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}

interface SettingsRow {
  label: string;
  blurb: string;
  /** Where the setting stands now, when the landing knows it. */
  value?: string;
  href: string;
}

function SettingsLink({ row }: { row: SettingsRow }) {
  return (
    <Link
      href={row.href}
      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground group-hover:text-primary">
          {row.label}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{row.blurb}</span>
      </span>
      {row.value ? (
        <span className="max-w-[40%] truncate text-right text-sm text-muted-foreground" title={row.value}>
          {row.value}
        </span>
      ) : null}
      <ChevronRightGlyph className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}
