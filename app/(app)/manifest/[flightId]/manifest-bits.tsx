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
    revenue: "text-status-blue",
    comp: "text-status-yellow",
    employee: "text-status-green",
  };
  const label = TICKET_TYPE_LABELS[ticket as TicketType] ?? ticket;
  return (
    <span
      className={
        "status-mark " +
        (tones[ticket] ?? "text-muted-foreground")
      }
    >
      {label}
    </span>
  );
}

export function MailBadge({ mailClass }: { mailClass: string }) {
  return (
    <span className="eyebrow">
      {MAIL_CLASS_LABELS[mailClass as MailClass] ?? mailClass}
    </span>
  );
}

export function Flag({ label, tone }: { label: string; tone: "blue" | "yellow" | "red" | "green" }) {
  const map: Record<typeof tone, string> = {
    blue: "text-status-blue",
    yellow: "text-status-yellow",
    red: "text-status-red",
    green: "text-status-green",
  };
  return (
    <span className={"status-mark " + map[tone]}>
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
        className="notice notice-red col-span-full text-xs"
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
