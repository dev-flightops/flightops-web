import Link from "next/link";

/**
 * The tab bar on an employee record.
 *
 * Legacy shows Profile / Documents / Onboarding / Drug & Alcohol.
 * Profile and Documents are ours now; the other two are subsystems
 * nobody has scheduled — legacy carries 5 tables behind Onboarding and
 * 9 behind Drug & Alcohol, the latter including the 14 CFR 120.217
 * annual MIS summary.
 *
 * They stay rendered and marked, because dropping them hides that the
 * record has more to it and linking them would give two 404s. Marked
 * "Not built" rather than "Soon": neither is on a story list, and
 * "soon" is a commitment nothing backs.
 *
 * Lifted out of employee-record-form.tsx once Documents became a real
 * tab, so both panels render the same bar rather than each owning a
 * copy that can drift.
 */

export type RecordTab = "profile" | "documents";

const UNBUILT = ["Onboarding", "Drug & Alcohol"] as const;

export function RecordTabs({
  employeeId,
  active,
  /** Shown on the Documents tab so an outstanding item is visible
   *  without opening it. Omitted when nothing is outstanding, rather
   *  than rendering a zero. */
  outstanding,
}: {
  employeeId: string;
  active: RecordTab;
  outstanding?: number;
}) {
  return (
    <nav
      aria-label="Employee record sections"
      className="mb-5 flex flex-wrap items-center gap-1 border-b border-border"
    >
      <Tab href={`/employees/${employeeId}`} active={active === "profile"}>
        Profile
      </Tab>
      <Tab
        href={`/employees/${employeeId}?tab=documents`}
        active={active === "documents"}
      >
        Documents
        {outstanding !== undefined && outstanding > 0 && (
          <span
            className="ml-1.5 rounded-full bg-status-yellow/15 px-1.5 py-0.5 text-[0.6rem] font-bold text-status-yellow"
            title={`${outstanding} document${outstanding === 1 ? "" : "s"} needing attention`}
          >
            {outstanding}
          </span>
        )}
      </Tab>
      {UNBUILT.map((label) => (
        <span
          key={label}
          title={`${label} is not built yet and is not currently scheduled`}
          className="-mb-px cursor-not-allowed px-3 py-2 text-xs font-semibold text-muted-foreground/50"
        >
          {label}
          <span className="ml-1.5 rounded border border-border px-1 py-0.5 text-[0.55rem] uppercase tracking-wider">
            Not built
          </span>
        </span>
      ))}
    </nav>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  if (active) {
    return (
      <span
        aria-current="page"
        className="-mb-px border-b-2 border-primary px-3 py-2 text-xs font-semibold text-primary"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="-mb-px px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
    >
      {children}
    </Link>
  );
}
