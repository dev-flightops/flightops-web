import Link from "next/link";

/**
 * Segmented control for the Employees page — Active / Terminated / All.
 * Server-rendered with plain `<Link>`s so the filter state stays in the
 * URL query and the page can revalidate its data server-side. Matches
 * the pill-group styling on legacy peregrineflight.com/employees/.
 */
export function StatusFilter({
  value,
}: {
  value: "active" | "terminated" | "all";
}) {
  const opts: Array<{ id: "active" | "terminated" | "all"; label: string }> = [
    { id: "active", label: "Active" },
    { id: "terminated", label: "Terminated" },
    { id: "all", label: "All" },
  ];
  return (
    <div
      role="group"
      aria-label="Filter employees by status"
      className="inline-flex overflow-hidden rounded-md border border-border bg-card"
    >
      {opts.map((o) => {
        const active = o.id === value;
        return (
          <Link
            key={o.id}
            href={o.id === "active" ? "/employees" : `/employees?status=${o.id}`}
            aria-pressed={active}
            className={
              "px-3 py-1.5 text-xs font-semibold transition-colors " +
              (active
                ? "bg-muted/40 text-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
