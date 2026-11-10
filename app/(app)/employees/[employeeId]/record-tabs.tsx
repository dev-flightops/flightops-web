import Link from "next/link";

/**
 * The tab bar on an employee record.
 *
 * Legacy shows Profile / Documents / Onboarding / Drug & Alcohol.
 * Profile, Documents and Onboarding (#180) are ours. Drug & Alcohol is
 * its own subsystem, legacy's 9 tables with the random pool and the
 * annual MIS summary, and is the next story.
 *
 * Unbuilt tabs were shown dimmed and marked "Not built". The client
 * counts such marks as faults (#157 took them off the dashboards), so
 * Drug & Alcohol isn't shown until it's built (#134).
 *
 * Lifted out of employee-record-form.tsx once Documents became a real
 * tab, so both panels render the same bar rather than each owning a
 * copy that can drift.
 */

export type RecordTab = "profile" | "documents" | "onboarding";

export function RecordTabs({
  employeeId,
  active,
  /** Shown on the Documents tab so an outstanding item is visible
   *  without opening it. Omitted when nothing is outstanding, rather
   *  than rendering a zero. */
  outstanding,
  /** Onboarding tasks required before starting that aren't done (#180). */
  requiredOpen,
}: {
  employeeId: string;
  active: RecordTab;
  outstanding?: number;
  requiredOpen?: number;
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
            className="status-mark ml-1.5 text-status-yellow"
            title={`${outstanding} document${outstanding === 1 ? "" : "s"} needing attention`}
          >
            {outstanding}
          </span>
        )}
      </Tab>
      <Tab
        href={`/employees/${employeeId}?tab=onboarding`}
        active={active === "onboarding"}
      >
        Onboarding
        {requiredOpen !== undefined && requiredOpen > 0 && (
          <span
            className="status-mark ml-1.5 text-status-red"
            title={`${requiredOpen} task${requiredOpen === 1 ? "" : "s"} required before starting`}
          >
            {requiredOpen}
          </span>
        )}
      </Tab>
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
