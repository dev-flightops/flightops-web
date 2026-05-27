import { CheckCircle2 } from "lucide-react";

import { formatDate } from "@/lib/utils";
import type { UserRef } from "@/lib/api/types";

interface ReleasedFooterProps {
  releasedAt: string;
  releasedBy: UserRef;
}

export function ReleasedFooter({ releasedAt, releasedBy }: ReleasedFooterProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm"
      data-testid="released-footer"
    >
      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
      <div>
        <p className="font-medium">Released</p>
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
