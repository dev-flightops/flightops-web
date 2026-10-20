import { CheckGlyph } from "@/components/ff/glyphs";

import { formatDate } from "@/lib/utils";
import type { UserRef } from "@/lib/api/types";

interface ReleasedFooterProps {
  releasedAt: string;
  releasedBy: UserRef;
}

export function ReleasedFooter({ releasedAt, releasedBy }: ReleasedFooterProps) {
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
            {formatDate(releasedAt)}
          </time>
        </p>
      </div>
    </div>
  );
}
