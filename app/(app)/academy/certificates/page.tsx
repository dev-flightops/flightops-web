import Link from "next/link";
import { formatZuluDate } from "@/lib/format/flight-time";
import { hasAnyRole, roleGate } from "@/lib/roles";

import { auth } from "@/auth";
import {
  COURSE_CATEGORY_LABELS,
  type Certificate,
  listCertificates,
  listMyCertificates,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

import { AcademyHeader } from "../academy-header";

const ADMIN_ROLES = roleGate("chief_pilot", "exec_admin");

/**
 * /academy/certificates — Certificate list.
 *
 * Default view for any authenticated user is their own certificates
 * (backend: GET /academy/certificates/mine). Chief pilots and exec
 * admins additionally see a "Show: All / Mine" toggle in the URL
 * (?scope=all) that flips to the tenant roster (backend: GET
 * /academy/certificates), which the backend gates on role.
 *
 * Cert rows are sorted current → nearest-expiring so an operator
 * scanning the list can spot upcoming renewals first.
 */
export const dynamic = "force-dynamic";

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  const isAdmin = hasAnyRole([...roles], ADMIN_ROLES);
  const wantAll = isAdmin && scope === "all";

  let certs: Certificate[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const resp = wantAll
      ? await listCertificates({ limit: 500 })
      : await listMyCertificates({ limit: 200 });
    certs = resp.items;
    total = resp.total;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You don't have access to this view."
          : "Certificate feed unavailable. Try refreshing.";
  }

  const now = Date.now();
  const sorted = [...certs].sort((a, b) => {
    const ax =
      a.expires_at === null
        ? Number.POSITIVE_INFINITY
        : new Date(a.expires_at).getTime();
    const bx =
      b.expires_at === null
        ? Number.POSITIVE_INFINITY
        : new Date(b.expires_at).getTime();
    return ax - bx;
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <AcademyHeader activeSection="certificates" />
      <p className="mb-6 text-sm text-muted-foreground">
        {wantAll
          ? "Tenant-wide roster of every certificate issued by Peregrine Academy."
          : "Certificates you have earned. Recurrent-training cycles land here as they issue."}
      </p>

      {isAdmin && (
        <nav
          aria-label="Certificate scope"
          className="mb-4 flex flex-wrap items-center gap-2"
        >
          <ScopeTab href="/academy/certificates" label="Mine" active={!wantAll} />
          <ScopeTab
            href="/academy/certificates?scope=all"
            label="All (tenant)"
            active={wantAll}
          />
        </nav>
      )}

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {loadError}
        </div>
      )}

      {!loadError && total === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-10 text-center text-sm text-muted-foreground">
          {wantAll
            ? "No certificates have been issued in this tenant yet."
            : "No certificates yet. Complete a course to earn your first one."}
        </div>
      )}

      {sorted.length > 0 && (
        <ul className="space-y-2">
          {sorted.map((c) => (
            <CertRow key={c.id} cert={c} now={now} showLearner={wantAll} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CertRow({
  cert,
  now,
  showLearner,
}: {
  cert: Certificate;
  now: number;
  showLearner: boolean;
}) {
  const expiryClass = _expiryClass(cert.expires_at, now);
  return (
    <li className="rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/5">
      <Link
        href={`/academy/certificates/${cert.id}`}
        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-muted-foreground">
            {COURSE_CATEGORY_LABELS[cert.course.category]} ·{" "}
            <span className="font-mono">{cert.cert_number}</span>
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {cert.course.title}
          </div>
          {showLearner && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              Issued to {cert.user.full_name} ({cert.user.email})
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-0.5 sm:text-right">
          <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            Issued
          </span>
          <span className="font-mono text-xs text-foreground">
            {_fmtDate(cert.issued_at)}
          </span>
          <span
            className={
              "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
              expiryClass.className
            }
          >
            {expiryClass.label}
          </span>
        </div>
      </Link>
    </li>
  );
}

function ScopeTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-md border px-3 py-1 text-xs font-semibold transition " +
        (active
          ? "border-status-blue bg-status-blue/15 text-status-blue"
          : "border-border bg-card text-foreground/80 hover:bg-muted/20")
      }
    >
      {label}
    </Link>
  );
}

/** Green (>60d), yellow (<=60d but not expired), red (expired),
 *  grey (never expires). Consistent with the compliance-board
 *  color scale so operators reuse the mental model. */
function _expiryClass(
  expiresAt: string | null,
  now: number,
): { label: string; className: string } {
  if (expiresAt === null) {
    return {
      label: "Never expires",
      className: "border-border bg-muted/40 text-muted-foreground",
    };
  }
  const ms = new Date(expiresAt).getTime() - now;
  const days = Math.round(ms / 86_400_000);
  if (days < 0) {
    return {
      label: `Expired ${-days}d ago`,
      className: "border-status-red/40 bg-status-red/10 text-status-red",
    };
  }
  if (days <= 60) {
    return {
      label: `Expires in ${days}d`,
      className:
        "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    };
  }
  return {
    label: `Valid · ${_fmtDate(expiresAt)}`,
    className: "border-status-green/40 bg-status-green/10 text-status-green",
  };
}

// A certificate's valid-until date is a compliance fact. Pinned to UTC so
// it names the same day whatever host renders it — the version this
// replaced took the host's zone.
const _fmtDate = formatZuluDate;
