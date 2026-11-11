import Link from "next/link";

/**
 * The tab bar on an employee record.
 *
 * Legacy shows Profile / Documents / Onboarding / Drug & Alcohol, and
 * so does this: Onboarding came with #180, Drug & Alcohol with the DOT
 * testing program (Greg, 11 Nov). The record is the Exec Admins', who
 * run that program, so its tab shows the tests and why someone isn't
 * cleared.
 *
 * Lifted out of employee-record-form.tsx once Documents became a real
 * tab, so both panels render the same bar rather than each owning a
 * copy that can drift.
 */

export type RecordTab = "profile" | "documents" | "onboarding" | "drug-alcohol";

export function RecordTabs({
  employeeId,
  active,
  /** Shown on the Documents tab so an outstanding item is visible
   *  without opening it. Omitted when nothing is outstanding, rather
   *  than rendering a zero. */
  outstanding,
  /** Onboarding tasks required before starting that aren't done (#180). */
  requiredOpen,
  /** Safety-sensitive and not cleared under the drug and alcohol program. */
  notCleared,
}: {
  employeeId: string;
  active: RecordTab;
  outstanding?: number;
  requiredOpen?: number;
  notCleared?: boolean;
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
      <Tab
        href={`/employees/${employeeId}?tab=drug-alcohol`}
        active={active === "drug-alcohol"}
      >
        Drug &amp; Alcohol
        {notCleared ? (
          <span className="status-mark ml-1.5 text-status-red" title="Not cleared for safety-sensitive duty">
            !
          </span>
        ) : null}
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
