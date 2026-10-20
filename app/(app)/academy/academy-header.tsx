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
    // The kit's page head (#85): the title and its line, actions to the
    // right, a rule beneath; no icon tile.
    <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="page-title text-balance">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
