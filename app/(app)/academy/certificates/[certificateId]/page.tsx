import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  COURSE_CATEGORY_LABELS,
  type Certificate,
  getCertificate,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

import { PrintCertificateButton } from "./print-button";

/**
 * /academy/certificates/[id] — Certificate detail.
 *
 * Renders the certificate as a printable card. Course + issue +
 * expiry are the payload the backend persists; the "print this"
 * affordance uses the browser's native print dialog (the styled
 * card is what the operator prints).
 */
export const dynamic = "force-dynamic";

export default async function CertificateDetailPage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;

  let cert: Certificate;
  try {
    cert = await getCertificate(certificateId);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 401) redirect("/login");
      if (err.status === 403) redirect("/academy/certificates");
    }
    throw err;
  }

  const now = Date.now();
  const status = _certStatus(cert.expires_at, now);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link
            href="/academy/certificates"
            className="hover:text-foreground"
          >
            ← Certificates
          </Link>
        </p>
      </header>

      <article
        className="rounded-2xl border-2 border-status-yellow/40 bg-card px-6 py-8 shadow-sm sm:px-10 sm:py-12"
        aria-label="Certificate of completion"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.1em] text-status-yellow">
              Peregrine Academy
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              Certificate of Completion
            </h1>
          </div>
          <span
            className={
              "rounded border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
              status.className
            }
          >
            {status.label}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          This certifies that
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {cert.user.full_name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {cert.user.email}
        </p>

        <p className="mt-6 text-sm text-muted-foreground">
          has completed the training course
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {cert.course.title}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.06em] text-muted-foreground">
          {COURSE_CATEGORY_LABELS[cert.course.category]}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-border pt-6 text-sm">
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
              Certificate number
            </div>
            <div className="mt-0.5 font-mono text-foreground">
              {cert.cert_number}
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
              Issued
            </div>
            <div className="mt-0.5 font-mono text-foreground">
              {_fmtDate(cert.issued_at)}
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
              Expires
            </div>
            <div className="mt-0.5 font-mono text-foreground">
              {cert.expires_at ? _fmtDate(cert.expires_at) : "Never expires"}
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
              Enrollment
            </div>
            <Link
              href={`/academy/enrollments/${cert.enrollment_id}`}
              className="mt-0.5 font-mono text-xs text-status-blue hover:underline"
            >
              View progress →
            </Link>
          </div>
        </div>
      </article>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <PrintCertificateButton />
        <span>
          Prints to a single page. FAR 135 recurrent training records
          should be retained per your operator&rsquo;s records
          policy.
        </span>
      </div>
    </div>
  );
}

function _certStatus(
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
      label: "Expired",
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
    label: "Valid",
    className:
      "border-status-green/40 bg-status-green/10 text-status-green",
  };
}

function _fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
