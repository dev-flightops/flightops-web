import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Stub — the rich 7-tab e-log detail page from legacy
 * `templates/elog/log_page.html` (Flight Info / Legs / W&B / Flight
 * Summary / Trends / VOR / Misc) lands in M3 with its child tables.
 *
 * Shipped now so the M2-G-26b "Start Flight Log" submit + Active
 * Drafts panel links don't 404 — every newly-created draft lands
 * here. Renders a friendly placeholder + link back to the landing.
 */
export default async function FlightLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        Flight Log
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Draft created. The rich log editor — flight info, legs, W&amp;B,
        VOR checks, trends, and miscellaneous notes — lands in M3.
        Your draft is saved as <span className="font-mono">{id}</span>
        {" "}and will be picked up automatically once the editor ships.
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-6">
        <Link href="/flight-log">← Back to logs</Link>
      </Button>
    </div>
  );
}
