import { CheckGlyph } from "@/components/ff/glyphs";

import { localDateTime } from "@/lib/format/local-time";
import type { UserRef } from "@/lib/api/types";

interface ReleasedFooterProps {
  releasedAt: string;
  releasedBy: UserRef;
  /** The departure base's zone (#68). The release time was formatted on
   *  the server with no zone, so it read in UTC with no label: a flight
   *  released at 01:04 AKST said "10:04 AM" (20 Nov). */
  timeZone: string;
}

/** "Nov 20, 2026, 01:04 AKST (10:04Z)", as the FRAT's sign-offs read. */
export function releasedAtText(releasedAt: string, timeZone: string): string {
  const at = new Date(releasedAt);
  if (Number.isNaN(at.getTime())) return releasedAt;
  return `${localDateTime(releasedAt, timeZone, { withYear: true })} (${at.toISOString().slice(11, 16)}Z)`;
}

export function ReleasedFooter({ releasedAt, releasedBy, timeZone }: ReleasedFooterProps) {
  return (
    <div
      className="notice notice-green flex items-center gap-3 text-sm"
      data-testid="released-footer"
    >
      <CheckGlyph className="h-5 w-5 flex-shrink-0 text-status-green" />
      <div>
        <p className="notice-label text-status-green">Released</p>
        <p className="text-muted-foreground">
          by <span className="font-medium text-foreground">{releasedBy.full_name}</span>{" "}
          at{" "}
          <time dateTime={releasedAt} className="font-mono">
            {releasedAtText(releasedAt, timeZone)}
          </time>
        </p>
      </div>
    </div>
  );
}
