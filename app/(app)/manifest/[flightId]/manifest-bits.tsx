import { MAIL_CLASS_LABELS, TICKET_TYPE_LABELS, type MailClass, type TicketType } from "@/lib/api/manifest";

/** Pieces shared by the manifest page and its client sections. No hooks,
 *  so both can import them. */

export const FIELD = "ff-input text-xs";

export const TH = "px-3 py-2.5 font-semibold";

export const THEAD =
  "border-b border-border bg-muted/60 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground";

export function fmtLbs(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

export function TicketBadge({ ticket }: { ticket: string }) {
  const tones: Record<string, string> = {
    revenue: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    comp: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    employee: "border-status-green/40 bg-status-green/10 text-status-green",
  };
  const label = TICKET_TYPE_LABELS[ticket as TicketType] ?? ticket;
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        (tones[ticket] ?? "border-border bg-muted text-muted-foreground")
      }
    >
      {label}
    </span>
  );
}

export function MailBadge({ mailClass }: { mailClass: string }) {
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
      {MAIL_CLASS_LABELS[mailClass as MailClass] ?? mailClass}
    </span>
  );
}

export function Flag({ label, tone }: { label: string; tone: "blue" | "yellow" | "red" | "green" }) {
  const map: Record<typeof tone, string> = {
    blue: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    yellow: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    red: "border-status-red/40 bg-status-red/10 text-status-red",
    green: "border-status-green/40 bg-status-green/10 text-status-green",
  };
  return (
    <span className={"rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " + map[tone]}>
      {label}
    </span>
  );
}

/** A refused submit's message, or a done one's. */
export function FormNotice({ status, message }: { status: string; message?: string }) {
  if (!message) return null;
  if (status === "error") {
    return (
      <div
        role="alert"
        className="col-span-full rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
      >
        {message}
      </div>
    );
  }
  if (status === "ok") {
    return (
      <p role="status" className="col-span-full text-xs font-semibold text-status-green">
        {message}
      </p>
    );
  }
  return null;
}
