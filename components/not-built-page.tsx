import Link from "next/link";

import { PageHeader } from "@/components/ff/page-header";

/**
 * The page for a feature legacy has and this platform has not built.
 *
 * Six maintenance pages used to render legacy's layout for features with
 * nothing behind them — forms, tables and "Begin Work" / "+ Add Part"
 * buttons styled to look live and wired to nothing, because no
 * maintenance-service endpoint exists for them. The nav called them
 * live, because their page files existed. A page that looks like it
 * works and does not is worse than one that says so.
 *
 * The nav marks these entries `planned`, and
 * components/home/module-status.test.ts treats a page that renders this
 * component as a placeholder: a live nav entry may not point at one.
 */
export function NotBuiltPage({
  title,
  summary,
  meanwhile,
}: {
  title: string;
  /** What the feature is for, in the operator's words. */
  summary: string;
  /** Where the nearest thing that does exist lives, if anywhere. */
  meanwhile?: { text: string; href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        back={{ href: "/maintenance", label: "Maintenance" }}
        title={title}
        description={summary}
      />
      <div role="status" className="notice notice-gray text-sm">
        <p className="notice-label">This isn&apos;t built yet.</p>
        {meanwhile ? (
          <p className="mt-1">
            {meanwhile.text}{" "}
            <Link
              href={meanwhile.href}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {meanwhile.label}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
