import Link from "next/link";

/**
 * Shared "Peregrine Academy" header + section sub-nav.
 *
 * Legacy peregrineflight.com/academy/ header shape:
 *   🎓 Peregrine Academy
 *      Training courses, assignments, and certification
 *
 *   Dashboard | Course Library | Assignments | Certificates | Reports | Studio
 */
export function AcademyHeader({
  activeSection,
}: {
  activeSection:
    | "dashboard"
    | "course-library"
    | "my-training"
    | "assignments"
    | "certificates"
    | "reports"
    | "studio";
}) {
  return (
    <>
      <header className="mb-4 flex items-start gap-3">
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
          <h1 className="text-2xl font-bold tracking-tight">
            Peregrine Academy
          </h1>
          <p className="text-sm text-muted-foreground">
            Training courses, assignments, and certification
          </p>
        </div>
      </header>

      <nav
        aria-label="Academy sections"
        className="mb-6 flex flex-wrap items-center gap-2"
      >
        <SectionTab
          href="/academy/dashboard"
          label="Dashboard"
          active={activeSection === "dashboard"}
        />
        <SectionTab
          href="/academy"
          label="Course Library"
          active={activeSection === "course-library"}
        />
        <SectionTab
          href="/academy/mine"
          label="My Training"
          active={activeSection === "my-training"}
        />
        <SectionTab
          href="/academy/assignments"
          label="Assignments"
          active={activeSection === "assignments"}
        />
        <SectionTab
          href="/academy/certificates"
          label="Certificates"
          active={activeSection === "certificates"}
        />
        <SectionTab
          href="/academy/reports"
          label="Reports"
          active={activeSection === "reports"}
        />
        <SectionTab
          href="/academy/studio"
          label="Studio"
          active={activeSection === "studio"}
        />
      </nav>
    </>
  );
}

/** One "you are here" style, the department strip's: brand on its /10
 *  selected tint. Legacy coloured Course Library yellow and Studio purple
 *  (always, even inactive); in the unified theme yellow is a status and
 *  purple means AI, so neither can double as a section colour. */
function SectionTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  const cls = active
    ? "border-primary/40 bg-primary/10 text-primary"
    : "border-border bg-card text-foreground/80 hover:bg-accent";
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={"rounded-md border px-3.5 py-1.5 text-sm font-semibold transition " + cls}
    >
      {label}
    </Link>
  );
}
