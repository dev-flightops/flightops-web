"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AirmanRecordCard } from "@/components/compliance/airman-record-card";
import { hasAnyRole, roleGate } from "@/lib/roles";
import type {
  AirmanRecordResponse,
  DisqualificationListResponse,
  UserResponse,
} from "@/lib/api/types";

import type { SaveEmployeeState } from "./actions";

/**
 * The employee record behind /employees/{id}.
 *
 * LAYOUT FOLLOWS THE LEGACY PAGE
 *
 * The first version of this was a read-only 2×2 grid of small panels
 * with right-aligned label/value pairs, which looked nothing like
 * /employees/76. That page is a form: full-width cards stacked down the
 * page, three fields to a row, label above input, Save Changes at the
 * foot. Measured off the live page — 12px card radius, 20px padding,
 * three equal columns with a 16px gap, 11px uppercase labels, 38px
 * inputs — and rebuilt to match.
 *
 * Colours come from our tokens rather than legacy's hex. Legacy is
 * dark-only; this app renders in the viewer's theme, so copying its
 * palette would produce an unreadable page for anyone on light. The
 * structure and proportions are what carry the resemblance.
 *
 * Presentational half, split from employee-record.tsx so it renders
 * under vitest. The wrapper calls useActionState, which React 18 cannot
 * render there, and importing the server action pulls next-auth ->
 * next/server, which does not resolve either. Sixth time this repo has
 * needed the split.
 *
 * THE TABS
 *
 * Legacy shows Profile / Documents / Onboarding / Drug & Alcohol. Only
 * Profile belongs to this module — the other three link into
 * /training/employee/{id}/docs, /records/onboarding/employee/{id} and
 * /records/dat/employee/{id}, none of which exist here yet. They are
 * rendered in place and marked unavailable rather than omitted: dropping
 * them hides that the record has more to it, and linking them would give
 * three 404s.
 *
 * WHY THE FIELDS ARE CONTROLLED
 *
 * React resets an uncontrolled form once its action completes, including
 * when the action came back with an error. With defaultValue fields that
 * meant a rejected save — a mistyped date of birth, say — silently threw
 * away every other edit on the page and snapped the inputs back to the
 * stored record, leaving an error message next to fields that no longer
 * held what the user had typed. Holding the values in state keeps them
 * across that reset, so a failed save is something to correct rather
 * than something to retype.
 */

const EMPLOYMENT_TYPES = [
  ["", "— Select —"],
  ["full_time", "Full Time"],
  ["part_time", "Part Time"],
  ["contract", "Contract"],
  ["seasonal", "Seasonal"],
] as const;

// Legacy's list, which is what an operator's staff actually sort into.
const DEPARTMENTS = [
  "",
  "Operations",
  "Maintenance",
  "Administration",
  "Station Ops",
  "Training",
  "Management",
] as const;

/** Every field this form owns, and the same set the action submits. */
const EDITABLE = [
  "first_name",
  "last_name",
  "preferred_name",
  "emp_number",
  "date_of_birth",
  "hire_date",
  "termination_date",
  "employment_type",
  "department",
  "title",
  "station",
  "phone",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relation",
  "notes",
] as const;

type EditableField = (typeof EDITABLE)[number];
type Values = Record<EditableField, string>;
type Bind = (name: EditableField) => {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
};

function toValues(employee: UserResponse): Values {
  const record = employee as unknown as Record<string, unknown>;
  return Object.fromEntries(
    EDITABLE.map((field) => [field, (record[field] as string | null) ?? ""]),
  ) as Values;
}

/**
 * Roles for whom a 14 CFR 135.63 certificate record is expected. Used
 * only to decide between "no record on file yet" and leaving the
 * section out: a ramper has no airman certificate, and an empty
 * Certifications card on their record would read as missing data
 * rather than as not applicable.
 */
// 119.71 requires the Director of Operations to hold an airman
// certificate, so their record has one to show. Left out on the first
// pass and `role-gate-policy.test.ts` caught it, which is the policy
// holding on the merits rather than as a convention.
//
// The DOM is deliberately absent: 119.71 wants a mechanic certificate
// from them, which is not the 135.63 pilot record this section shows.
// Flight attendants likewise.
//
// Kept OUTSIDE the roleGate() call on purpose — see the note in
// role-gate-policy.test.ts about comments and the scanner.
const FLIGHT_CREW = roleGate(
  "pilot",
  "chief_pilot",
  "check_airman",
  "director_of_operations",
);

export function EmployeeRecordForm({
  employee,
  airman = null,
  disqualifications = null,
  state,
  action,
  pending,
}: {
  employee: UserResponse;
  airman?: AirmanRecordResponse | null;
  disqualifications?: DisqualificationListResponse | null;
  state: SaveEmployeeState;
  /** The bound action from useActionState, or a stub under test. */
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const [values, setValues] = useState(() => toValues(employee));

  // Adopt the stored record whenever it actually changes — which in
  // practice means a save landed and revalidatePath handed us back what
  // the server kept, including anything it normalised. Compared by
  // content rather than object identity: a re-render that hands over an
  // equal-but-new record must not wipe edits in progress.
  const stored = JSON.stringify(toValues(employee));
  const [syncedFrom, setSyncedFrom] = useState(stored);
  if (stored !== syncedFrom) {
    setSyncedFrom(stored);
    setValues(toValues(employee));
  }

  const bind: Bind = (name) => ({
    value: values[name],
    onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  // WHY THE FORM IS REMOUNTED AFTER EVERY SAVE
  //
  // React resets the form's DOM once the action completes. Controlled
  // text inputs survive that — React restores their value — but a
  // controlled `<select>` does not: the reset leaves the DOM on the
  // first option while React's own value is unchanged, so React sees
  // nothing to patch and the box stays blank.
  //
  // That was data loss, not cosmetics. Department and Employment type
  // are the only two selects here. Setting Department on a record that
  // had none saved correctly and then showed an empty box; because the
  // action sends every field it owns and treats blank as "clear", the
  // next Save wiped both from a record that had just been filled in.
  //
  // Keyed on the completed-save count and not just on the stored
  // record: saving a record whose values did not change leaves the
  // record identical, so a key derived from content alone would not
  // change and the blanked selects would survive into the next submit.
  // That is the case that still lost data after the first attempt at
  // this fix.
  const [saveCount, setSaveCount] = useState(0);
  const wasPending = useRef(pending);
  useEffect(() => {
    if (wasPending.current && !pending) setSaveCount((n) => n + 1);
    wasPending.current = pending;
  }, [pending]);

  // Remounting re-initialises every DOM node from `values`, which
  // still holds the operator's edits — so this is also correct after a
  // REJECTED save, where the point is not to make them retype.
  const formKey = `${syncedFrom}::${saveCount}`;

  const displayName = employee.preferred_name?.trim() || employee.full_name;
  const subtitle =
    [employee.emp_number, employee.department, employee.title]
      .filter(Boolean)
      .join(" · ") || "No employment details recorded";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link
        href="/employees"
        className="mb-3 inline-block text-xs font-semibold text-status-blue hover:underline"
      >
        ← Employees
      </Link>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">
            {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
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

      <nav
        aria-label="Employee record sections"
        className="mb-5 flex flex-wrap items-center gap-1 border-b border-border"
      >
        <span
          aria-current="page"
          className="-mb-px border-b-2 border-status-blue px-3 py-2 text-xs font-semibold text-status-blue"
        >
          Profile
        </span>
        {/* "Soon" was a commitment nothing backs: none of these three is
            in M4's story list, and each is a subsystem rather than a
            screen — legacy carries 3 tables behind Documents, 5 behind
            Onboarding and 9 behind Drug & Alcohol, including the
            14 CFR 120.217 annual MIS summary. Saying "not built" is
            true; saying "soon" invites a reader to wait for a date
            nobody has set. */}
        {["Documents", "Onboarding", "Drug & Alcohol"].map((label) => (
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

      <form key={formKey} action={action} className="space-y-4">
        <input type="hidden" name="employee_id" value={employee.id} />

        {state.status === "error" ? (
          <p
            role="alert"
            className="rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-2.5 text-sm text-status-red"
          >
            {state.error}
          </p>
        ) : null}
        {state.status === "saved" ? (
          <p
            role="status"
            className="rounded-lg border border-status-green/40 bg-status-green/10 px-4 py-2.5 text-sm text-status-green"
          >
            Saved.
          </p>
        ) : null}

        <Card title="Identity">
          <Text name="first_name" label="First name" bind={bind} />
          <Text name="last_name" label="Last name" bind={bind} />
          <Text name="preferred_name" label="Preferred name" bind={bind} />
          <Text name="emp_number" label="Employee number" bind={bind} />
          <DateField name="date_of_birth" label="Date of birth" bind={bind} />
        </Card>

        <Card title="Employment">
          <DateField name="hire_date" label="Hire date" bind={bind} />
          <DateField
            name="termination_date"
            label="Termination date"
            bind={bind}
          />
          <Select
            name="employment_type"
            label="Employment type"
            bind={bind}
            options={EMPLOYMENT_TYPES.map(([v, l]) => [v, l])}
          />
          <Select
            name="department"
            label="Department"
            bind={bind}
            options={DEPARTMENTS.map((d) => [d, d || "— Select —"])}
          />
          <Text name="title" label="Job title" bind={bind} />
          <Text
            name="station"
            label="Home station"
            bind={bind}
            maxLength={4}
          />
        </Card>

        <Card title="Contact">
          {/* Email is the login identity and is changed through user
              management, where it is checked for uniqueness. Editing it
              here would let two people end up sharing one. */}
          <Field label="Email">
            <p className="flex h-[38px] items-center text-xs text-muted-foreground">
              {employee.email}
            </p>
          </Field>
          <Text name="phone" label="Phone" bind={bind} />
          <Prose name="address" label="Address" rows={2} bind={bind} />
        </Card>

        <Card title="Emergency Contact">
          <Text name="emergency_contact_name" label="Name" bind={bind} />
          <Text name="emergency_contact_phone" label="Phone" bind={bind} />
          <Text
            name="emergency_contact_relation"
            label="Relationship"
            bind={bind}
          />
        </Card>

        {/* Its own card, as legacy has it — notes are about the person,
            not about who to call in an emergency. Legacy shows no card
            heading here, just the field label, so the heading is there
            for the region but not on screen. */}
        <Card title="Notes" headingHidden>
          <Prose name="notes" label="Notes" rows={3} bind={bind} />
        </Card>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save Changes"}
          </button>
          <Link
            href="/employees"
            className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>

      <Certifications
        employee={employee}
        airman={airman}
        disqualifications={disqualifications}
      />
    </div>
  );
}

const INPUT =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-xs " +
  "text-foreground focus:border-status-blue focus:outline-none";

function Card({
  title,
  children,
  headingHidden = false,
}: {
  title: string;
  children: React.ReactNode;
  /** Keeps the heading for the region but off the screen, where legacy
   *  shows the card with no title of its own. */
  headingHidden?: boolean;
}) {
  // Named region, because "Phone" appears in both Contact and Emergency
  // contact. Legacy has the same duplicate labels and leans on the
  // heading to disambiguate visually, which does nothing for a screen
  // reader reading the fields in order.
  const headingId = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-card p-5"
    >
      <h2
        id={headingId}
        className={
          headingHidden ? "sr-only" : "mb-4 text-sm font-semibold"
        }
      >
        {title}
      </h2>
      {/* Three to a row, as legacy has it. Collapses on narrow screens
          rather than shrinking the inputs past usefulness. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
    >
      {children}
    </label>
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
    <div>
      <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function Text({
  name,
  label,
  bind,
  maxLength,
}: {
  name: EditableField;
  label: string;
  bind: Bind;
  maxLength?: number;
}) {
  return (
    <div>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <input
        id={name}
        name={name}
        type="text"
        maxLength={maxLength}
        {...bind(name)}
        className={INPUT}
      />
    </div>
  );
}

function DateField({
  name,
  label,
  bind,
}: {
  name: EditableField;
  label: string;
  bind: Bind;
}) {
  return (
    <div>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <input
        id={name}
        name={name}
        type="date"
        // The API speaks ISO days and so does <input type="date">, so the
        // value passes through untouched. No parsing, and therefore no
        // zone to get wrong.
        {...bind(name)}
        className={INPUT}
      />
    </div>
  );
}

/** Address and notes are prose, so they get a box and the full row
 *  width — squeezing them into a third of one is why legacy does the
 *  same. */
function Prose({
  name,
  label,
  rows,
  bind,
}: {
  name: EditableField;
  label: string;
  rows: number;
  bind: Bind;
}) {
  return (
    <div className="sm:col-span-3">
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <textarea
        id={name}
        name={name}
        rows={rows}
        {...bind(name)}
        className={INPUT}
      />
    </div>
  );
}

function Select({
  name,
  label,
  bind,
  options,
}: {
  name: EditableField;
  label: string;
  bind: Bind;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <select id={name} name={name} {...bind(name)} className={INPUT}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The 135.63 certificate record, on the employee it belongs to.
 *
 * It was only ever rendered under /compliance/pilots/{id}, so an HR
 * reader opening an employee record saw no certifications at all — for
 * a pilot whose certificate, ratings and medical class were already on
 * file two clicks away. The card is the same component the compliance
 * page uses; this is a second place to read it, not a second copy of
 * the data, and it stays read-only here because currency and
 * disqualification release belong on the compliance surface.
 *
 * Three states, deliberately distinguished:
 *   a record exists         -> render it, plus a link to the full profile
 *   flight crew, no record  -> say it is not on file yet
 *   everyone else           -> render nothing
 *
 * That last case is the point of FLIGHT_CREW. A ramp agent has no
 * airman certificate, and an empty Certifications card on their record
 * would read as missing data rather than as not applicable.
 */
function Certifications({
  employee,
  airman,
  disqualifications,
}: {
  employee: UserResponse;
  airman: AirmanRecordResponse | null;
  disqualifications: DisqualificationListResponse | null;
}) {
  // Role first, because the endpoint never 404s. `get_airman_record`
  // documents that "a pilot with none yet returns empty fields rather
  // than a 404 — not having filled it in is the starting state", so an
  // empty shell comes back for ANY user id, ground agents included.
  // Gating on the response would have put a 14 CFR 135.63 card on a
  // ramper's record, which it did on the first attempt at this.
  if (!hasAnyRole(employee.roles ?? [], FLIGHT_CREW)) return null;

  // An entirely blank record is "nothing recorded yet", not a record.
  // Rendering the card for it gives eight rows reading "Not recorded",
  // which looks like the system lost something it was holding.
  const hasDetail = Boolean(
    airman &&
      (airman.certificate_type ||
        airman.certificate_number ||
        airman.medical_class ||
        airman.ratings.length > 0 ||
        airman.total_time_hours ||
        airman.experience_as_of ||
        airman.notes),
  );

  // Both or neither, matching the compliance page. The card counts open
  // disqualifications, and a fabricated empty list would render "none"
  // for a feed that simply did not load — which is a different claim
  // about a person's eligibility to fly.
  if (!airman || !hasDetail || !disqualifications) {
    return (
      <section aria-labelledby="certifications-heading" className="mb-5">
        <h2
          id="certifications-heading"
          className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Certifications
        </h2>
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {hasDetail
            ? "Certificate details are on file but the disqualification history could not be loaded, so the record is not shown here."
            : "No certificate or medical details recorded for this employee yet."}{" "}
          <Link
            href={`/compliance/pilots/${employee.id}`}
            className="font-semibold text-status-blue hover:underline"
          >
            Open their compliance profile
          </Link>
          {hasDetail ? "." : " to add them."}
        </p>
      </section>
    );
  }

  return (
    <section className="mb-5">
      {/* The card renders its own heading, so this wrapper only adds the
          way through to currency — which is the question a reader asks
          next and which this page does not answer. */}
      <AirmanRecordCard record={airman} disqualifications={disqualifications} />
      <p className="mt-2 text-xs text-muted-foreground">
        <Link
          href={`/compliance/pilots/${employee.id}`}
          className="font-semibold text-status-blue hover:underline"
        >
          Currency and disqualifications →
        </Link>
      </p>
    </section>
  );
}
