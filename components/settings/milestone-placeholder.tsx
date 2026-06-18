import { CalendarClock } from "lucide-react";
import Link from "next/link";

interface MilestonePlaceholderProps {
  /** Breadcrumb tail label — e.g. "Costs", "Load Teams". */
  breadcrumb: string;
  /** Page H1. Usually matches `breadcrumb`, but can be more descriptive. */
  title: string;
  /** One-line subtitle under the H1 — what this page will configure. */
  subtitle: string;
  /** Milestone the surface ships in — "M3", "M4", etc. Rendered as a
   *  highlighted callout. */
  availableAfter: string;
  /** Bullet list of the fields / controls the page will expose. */
  upcomingFields: string[];
}

/**
 * Settings sub-page placeholder. Used by /settings/{costs,load-teams,
 * pilot-pay,currency,billing} — sub-pages whose features land later
 * but whose URLs are reachable directly (bookmark, typed, or external
 * link from legacy peregrineflight). A bare Next.js 404 here would be
 * confusing — the placeholder explains *what* the page is for and
 * *when* it ships, matching the same pattern used by
 * `components/dashboards/placeholder-dashboard.tsx`.
 *
 * Once the underlying feature lands, swap the page from this stub to
 * the real implementation — the route stays the same so any bookmarks
 * keep working.
 */
export function SettingsMilestonePlaceholder({
  breadcrumb,
  title,
  subtitle,
  availableAfter,
  upcomingFields,
}: MilestonePlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">{breadcrumb}</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </header>

      <section className="rounded-xl border border-dashed border-border bg-muted/20 p-6">
        <div className="flex items-start gap-4">
          <CalendarClock className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Available after{" "}
              <span className="text-status-blue">{availableAfter}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              The route is reserved — bookmarks land here today and will
              start working once the underlying feature ships.
            </p>
            <ul className="ml-1 space-y-1.5 text-xs">
              {upcomingFields.map((field) => (
                <li
                  key={field}
                  className="before:mr-2 before:text-status-blue before:content-['→']"
                >
                  {field}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
