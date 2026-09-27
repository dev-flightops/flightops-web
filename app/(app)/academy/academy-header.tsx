import type { ReactNode } from "react";

/**
 * The academy's page header: the academy mark beside the page's own
 * title.
 *
 * It used to be one "Peregrine Academy" banner on every academy page,
 * with a row of section tabs under it — Dashboard, Course Library, My
 * Training, Assignments, Certificates, Reports, Studio. That row
 * repeated the department strip directly above it, entry for entry
 * except My Training, which now lives in the strip too. So the pages
 * name themselves, and the strip is the navigation, as it is everywhere
 * else in the app.
 */
export function AcademyHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  /** Right-aligned buttons for the page — Course Studio's, say. */
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6"
            aria-hidden
          >
            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
