import Link from "next/link";

import type { UserResponse } from "@/lib/api/types";
import { formatIsoDayLong } from "@/lib/iso-day";

/**
 * The employee record behind /employees/{id}.
 *
 * Presentational half, split from page.tsx so it renders under vitest —
 * page.tsx reaches lib/api -> apiFetch -> next-auth -> next/server, which
 * does not resolve there.
 *
 * Mirrors the legacy /employees/{id} Profile tab: Identity, Employment,
 * Contact, Emergency Contact. Legacy also carries a Housing Access
 * section, which is not here — it needs the housing-unit list and its own
 * role gate, and is tracked separately rather than half-built.
 *
 * The legacy page is a form. This is read-only for now: the record is
 * editable through the API, and shipping the display first means the
 * directory stops linking every employee at the same page, which is the
 * thing that was actually wrong.
 *
 * Absent fields say "Not recorded" rather than showing a dash, for the
 * same reason as the airman record — on a personnel record, blank and
 * zero-or-none are different claims, and a dash reads as either.
 */

export function EmployeeRecord({ employee }: { employee: UserResponse }) {
  const displayName =
    employee.preferred_name?.trim() || employee.full_name;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href="/employees"
        className="mb-3 inline-block text-xs font-semibold text-status-blue hover:underline"
      >
        ← Employees
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">
            {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              employee.emp_number,
              employee.department,
              employee.title,
            ]
              .filter(Boolean)
              .join(" · ") || "No employment details recorded"}
          </p>
        </div>
        <span
          className={
            "rounded border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
            (employee.is_active
              ? "border-status-green/40 bg-status-green/10 text-status-green"
              : "border-border bg-muted/20 text-muted-foreground")
          }
        >
          {employee.is_active ? "Active" : "Inactive"}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel title="Identity">
          <Field label="First name">{employee.first_name}</Field>
          <Field label="Last name">{employee.last_name}</Field>
          <Field label="Preferred name">{employee.preferred_name}</Field>
          <Field label="Employee number">
            {employee.emp_number ? (
              <span className="font-mono">{employee.emp_number}</span>
            ) : null}
          </Field>
          <Field label="Date of birth">
            {employee.date_of_birth
              ? formatIsoDayLong(employee.date_of_birth)
              : null}
          </Field>
        </Panel>

        <Panel title="Employment">
          <Field label="Hire date">
            {employee.hire_date ? formatIsoDayLong(employee.hire_date) : null}
          </Field>
          <Field label="Termination date">
            {employee.termination_date
              ? formatIsoDayLong(employee.termination_date)
              : null}
          </Field>
          <Field label="Employment type">
            {employee.employment_type
              ? EMPLOYMENT_TYPE_LABELS[employee.employment_type]
              : null}
          </Field>
          <Field label="Department">{employee.department}</Field>
          <Field label="Job title">{employee.title}</Field>
          <Field label="Home station">
            {employee.station ? (
              <span className="font-mono">{employee.station}</span>
            ) : null}
          </Field>
        </Panel>

        <Panel title="Contact">
          <Field label="Email">
            {employee.email ? (
              <a
                href={`mailto:${employee.email}`}
                className="text-status-blue hover:underline"
              >
                {employee.email}
              </a>
            ) : null}
          </Field>
          <Field label="Phone">{employee.phone}</Field>
          <Field label="Address">
            {employee.address ? (
              <span className="whitespace-pre-wrap">{employee.address}</span>
            ) : null}
          </Field>
        </Panel>

        <Panel title="Emergency contact">
          <Field label="Name">{employee.emergency_contact_name}</Field>
          <Field label="Phone">{employee.emergency_contact_phone}</Field>
          <Field label="Relationship">
            {employee.emergency_contact_relation}
          </Field>
        </Panel>
      </div>

      {employee.notes ? (
        <div className="mt-3 rounded-lg border border-border bg-card px-4 py-3">
          <h2 className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-xs text-foreground/80">
            {employee.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  seasonal: "Seasonal",
};

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <h2 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <dt className="flex-shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">
        {children ?? (
          <span className="font-normal italic text-muted-foreground/60">
            Not recorded
          </span>
        )}
      </dd>
    </div>
  );
}
