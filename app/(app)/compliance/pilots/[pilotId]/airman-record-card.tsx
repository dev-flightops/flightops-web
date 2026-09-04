import {
  CERTIFICATE_TYPE_LABELS,
  MEDICAL_CLASS_LABELS,
  RATING_LABELS,
  type AirmanRecordResponse,
  type DisqualificationListResponse,
  type DisqualificationResponse,
} from "@/lib/api/types";
import { formatIsoDayLong } from "@/lib/iso-day";

/**
 * The 14 CFR 135.63(a)(4) record: certificate and ratings, medical class,
 * aeronautical experience, and disqualification history.
 *
 * Presentational half, split from page.tsx so it can be rendered under
 * vitest — page.tsx reaches lib/api -> apiFetch -> next-auth ->
 * next/server, which does not resolve there.
 *
 * NOT RECORDED IS NOT THE SAME AS ZERO
 *
 * Every field renders "Not recorded" rather than a dash or a blank when
 * absent. This record is read by someone deciding whether a pilot is
 * qualified for the duty they are about to be assigned, and on that
 * screen "0.0 hours" and "we never wrote it down" are opposite answers.
 * A dash is ambiguous between them; the words are not.
 */

export function AirmanRecordCard({
  record,
  disqualifications,
}: {
  record: AirmanRecordResponse;
  disqualifications: DisqualificationListResponse;
}) {
  const open = disqualifications.items.filter((d) => d.released_on === null);

  return (
    <section aria-labelledby="airman-record-heading">
      <h2
        id="airman-record-heading"
        className="mt-6 mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground"
      >
        Airman record
        <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
          14 CFR 135.63(a)(4)
        </span>
      </h2>

      {/* Above the record rather than inside it: a pilot who is currently
          disqualified is the first thing a reader needs, not the ninth
          field down. */}
      {open.length > 0 ? (
        <p
          role="status"
          className="mb-3 rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-2.5 text-sm text-status-red"
        >
          <strong className="font-semibold">
            Currently disqualified
            {open.length > 1 ? ` (${open.length} open records)` : ""}.
          </strong>{" "}
          {open[0].reason}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel title="Certificate">
          <Field label="Type">
            {record.certificate_type
              ? (CERTIFICATE_TYPE_LABELS[record.certificate_type] ??
                record.certificate_type)
              : null}
          </Field>
          <Field label="Number">
            {record.certificate_number ? (
              <span className="font-mono">{record.certificate_number}</span>
            ) : null}
          </Field>
          <Field label="Ratings">
            {record.ratings.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {record.ratings.map((r) => (
                  <span
                    key={r}
                    title={RATING_LABELS[r] ?? r}
                    className="rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider"
                  >
                    {ratingChipText(r)}
                  </span>
                ))}
              </span>
            ) : null}
          </Field>
          <Field label="Medical class">
            {record.medical_class
              ? (MEDICAL_CLASS_LABELS[record.medical_class] ??
                record.medical_class)
              : null}
          </Field>
        </Panel>

        <Panel
          title="Aeronautical experience"
          // The date is part of the claim, not decoration: hours with no
          // date attached are refused server-side for the same reason.
          subtitle={
            record.experience_as_of
              ? `As of ${formatIsoDayLong(record.experience_as_of)}`
              : undefined
          }
        >
          <Hours label="Total time" value={record.total_time_hours} />
          <Hours label="Pilot in command" value={record.pic_time_hours} />
          <Hours label="Cross country" value={record.cross_country_hours} />
          <Hours label="Night" value={record.night_hours} />
          <Hours label="Instrument" value={record.instrument_hours} />
        </Panel>
      </div>

      {record.notes ? (
        <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          {record.notes}
        </p>
      ) : null}

      <h3 className="mt-6 mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Disqualifications
      </h3>
      {disqualifications.items.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No disqualifications recorded.
        </p>
      ) : (
        <ul className="space-y-2">
          {disqualifications.items.map((d) => (
            <DisqualificationRow key={d.id} row={d} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DisqualificationRow({ row }: { row: DisqualificationResponse }) {
  const isOpen = row.released_on === null;
  return (
    <li
      className={
        "rounded-lg border px-4 py-3 " +
        (isOpen
          ? "border-status-red/40 bg-status-red/[0.06]"
          : "border-border bg-card")
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{row.reason}</span>
        <span
          className={
            "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
            (isOpen
              ? "border-status-red/40 bg-status-red/10 text-status-red"
              : "border-status-green/40 bg-status-green/10 text-status-green")
          }
        >
          {isOpen ? "Open" : "Released"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="uppercase tracking-wider">{row.kind}</span>
        {" · "}
        Disqualified {formatIsoDayLong(row.disqualified_on)}
        {row.released_on ? (
          <>
            {" · "}
            Released {formatIsoDayLong(row.released_on)}
            {/* Who authorised the release is half of what the record is
                for. Shown whenever it is known. */}
            {row.released_by ? ` by ${row.released_by.full_name}` : ""}
          </>
        ) : null}
      </p>
    </li>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h3>
        {subtitle ? (
          <span className="text-[0.65rem] text-muted-foreground/70">
            {subtitle}
          </span>
        ) : null}
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
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
      <dd className="text-right font-medium">{children ?? <NotRecorded />}</dd>
    </div>
  );
}

function Hours({ label, value }: { label: string; value: string | null }) {
  return (
    <Field label={label}>
      {value === null ? null : (
        <span className="font-mono tabular-nums">
          {Number(value).toFixed(1)}
        </span>
      )}
    </Field>
  );
}

/**
 * Chip text for a rating code.
 *
 * Some codes are the abbreviation printed on the certificate — AMEL,
 * CFII — and read correctly as-is. Others are snake_case slugs
 * (`instrument_airplane`), and rendering those raw put a database value
 * on screen beside two real abbreviations. Underscores become spaces so
 * the chip reads as a rating rather than a column name; the full
 * expansion stays on the tooltip.
 *
 * No abbreviation is invented here. "INSTRUMENT AIRPLANE" is longer than
 * "AMEL" but it is what the certificate says, and a made-up short form
 * would be worse than a long true one.
 */
function ratingChipText(code: string): string {
  return code.replace(/_/g, " ");
}

/** Said in words rather than punctuation — see the note at the top. */
function NotRecorded() {
  return (
    <span className="font-normal italic text-muted-foreground/60">
      Not recorded
    </span>
  );
}
