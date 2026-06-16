import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  getCompanyProfile,
  getFlightTrackingConfig,
  listCompanyBases,
  listSsoProviders,
  listUsers,
} from "@/lib/api/auth";

/**
 * /settings — Settings landing.
 *
 * Foundational tenant settings: Company profile, Bases directory, Flight
 * Tracking thresholds, Users + Permissions, SSO. Pilot Pay + Currency
 * cards stay dim (M3).
 *
 * The Users count tile soft-falls back to "—" when the caller isn't
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tenant-wide configuration: company identity, bases, flight tracking,
          users, and integrations
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Company"
          value={companyName ?? "—"}
        />
        <StatTile label="Bases" value={basesCount} />
        <StatTile
          label="Overdue threshold"
          value={
            overdueMinutes === null ? "—" : `${overdueMinutes} min`
          }
        />
        <StatTile
          label="Tracking"
          value={simMode === null ? "—" : simMode ? "Simulation" : "Live"}
          accent={simMode ? "yellow" : undefined}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          icon="🏢"
          title="Company"
          blurb="Legal name, address, contacts, Part 135 certificate."
          links={[
            {
              label: "Company Profile",
              sublabel: companyName ?? "Not configured",
              href: "/settings/company",
              primary: true,
            },
          ]}
        />
        <SectionCard
          icon="📍"
          title="Bases"
          blurb="Master directory of ICAOs the operator works out of. Hub + active flags drive what other modules show."
          links={[
            {
              label: "Manage Bases",
              sublabel: `${basesCount} active`,
              href: "/settings/bases",
            },
          ]}
        />
        <SectionCard
          icon="📡"
          title="Flight Tracking"
          blurb="Overdue threshold, polling cadence, simulation mode, Spider Tracks AFF."
          links={[
            {
              label: "Tracking Config",
              sublabel:
                overdueMinutes === null
                  ? "—"
                  : `${overdueMinutes}-min overdue alert`,
              href: "/settings/flight-tracking",
            },
          ]}
        />
        <SectionCard
          icon="👥"
          title="Users & Permissions"
          blurb="Invite users, assign roles, manage per-tenant permissions."
          links={[
            {
              label: "Users",
              sublabel:
                usersTotal === null ? "—" : `${usersTotal} total`,
              href: "/settings/users",
              primary: true,
            },
            {
              label: "Permissions",
              sublabel: "Role catalog",
              href: "/settings/permissions",
            },
          ]}
        />
        <SectionCard
          icon="🔐"
          title="SSO & Integrations"
          blurb="Per-tenant SSO provider config (Google / Okta / Entra ID)."
          links={[
            {
              label: "SSO Providers",
              sublabel:
                ssoConnected === 0
                  ? "None connected"
                  : `${ssoConnected} active`,
              href: "/settings/sso",
            },
          ]}
        />
        <SectionCard
          icon="💰"
          title="Pilot Pay & Currency"
          blurb="Pay rates, per-diem, currency items + due-date catalog."
          links={[
            { label: "Pilot Pay", sublabel: "Coming in M3", disabled: true },
            { label: "Currency Items", sublabel: "Coming in M3", disabled: true },
          ]}
        />
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "yellow";
}) {
  const valueClass =
    accent === "yellow" ? "text-status-yellow" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <div
        className={`truncate text-xl font-bold leading-tight ${valueClass}`}
        title={String(value)}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

interface SectionLink {
  label: string;
  sublabel?: string;
  href?: string;
  primary?: boolean;
  disabled?: boolean;
}

function SectionCard({
  icon,
  title,
  blurb,
  links,
}: {
  icon: string;
  title: string;
  blurb: string;
  links: SectionLink[];
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2 text-xl">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      <ul className="mt-3 space-y-1.5">
        {links.map((link) => {
          if (link.disabled || !link.href) {
            return (
              <li key={`${link.label}-${link.sublabel ?? "x"}`}>
                <span
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center justify-between rounded-md border border-dashed border-border bg-card/40 px-3 py-2.5 text-sm text-muted-foreground"
                >
                  <span>
                    <span className="font-semibold">{link.label}</span>
                    {link.sublabel && (
                      <span className="ml-2 text-xs font-normal">
                        {link.sublabel}
                      </span>
                    )}
                  </span>
                </span>
              </li>
            );
          }
          return (
            <li key={`${link.label}-${link.href}`}>
              <Link
                href={link.href}
                className={
                  link.primary
                    ? "flex items-center justify-between rounded-md border border-status-blue bg-status-blue/15 px-3 py-2.5 text-sm font-semibold text-status-blue hover:bg-status-blue/20"
                    : "flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2.5 text-sm text-foreground hover:border-status-blue/60 hover:bg-status-blue/5"
                }
              >
                <span>
                  <span className="font-semibold">{link.label}</span>
                  {link.sublabel && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {link.sublabel}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
