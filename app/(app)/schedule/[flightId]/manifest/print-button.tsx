"use client";

import Link from "next/link";

export function PrintButton() {
  return (
    <div className="no-print mb-4 flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
      <Link
        href="/schedule"
        className="text-muted-foreground hover:text-foreground hover:underline"
      >
        ← Back to schedule
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 font-semibold text-status-blue hover:bg-status-blue/20"
      >
        🖨 Print release sheet
      </button>
    </div>
  );
}
