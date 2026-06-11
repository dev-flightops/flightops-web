import Link from "next/link";
import { notFound } from "next/navigation";

import { FlightCategoryBadge } from "@/components/weather/flight-category-badge";
import { ApiError } from "@/lib/api/client";
import { getWeatherBriefing } from "@/lib/api/weather";
import type {
  WeatherBriefingResponse,
  WeatherReportResponse,
} from "@/lib/api/types";

/**
 * /weather/{id} — saved Weather Briefing detail (M2-G-27).
 *
 * Layout matches legacy `templates/weather_briefing/briefing.html`:
 *   - max-w-5xl, py-10
 *   - "← Briefing History" back link
 *   - header: title + single-line subtitle (airports · flight ·
 *     n_number · timestamp · briefed by) + big category pill on the
 *     right
 *   - separate panels for METARs and TAFs, each rendered as the
 *     combined raw text from the snapshot (matches legacy
 *     metar_raw / taf_raw blocks)
 *   - Dispatcher Notes panel at the bottom (only when notes set)
 *
 * The page is read-only. Edit / delete is M3.
 */
export default async function WeatherBriefingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let briefing: WeatherBriefingResponse | null = null;
  let loadError: string | null = null;

  try {
    briefing = await getWeatherBriefing(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Briefing unavailable. Try refreshing in a moment.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <BackLink />
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      </div>
    );
  }
  if (briefing === null) notFound();  // unreachable in the happy path

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <BackLink />
      <Header briefing={briefing} />
      <MetarPanel briefing={briefing} />
      <TafPanel briefing={briefing} />
      <Notes notes={briefing.dispatcher_notes} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/weather"
      className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      ← Briefing History
    </Link>
  );
}

function Header({ briefing }: { briefing: WeatherBriefingResponse }) {
  const created = new Date(briefing.created_at);
  const stamp = `${created.toLocaleDateString("en-US", {
    timeZone: "America/Anchorage",
    month: "short",
    day: "numeric",
    year: "numeric",
  })} ${created.toLocaleTimeString("en-US", {
    timeZone: "America/Anchorage",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} AKD`;
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Weather Briefing</h1>
        <p className="text-sm text-muted-foreground">
          <span>{briefing.airports.join(", ")}</span>
          {briefing.flight && (
            <>
              {" · Flight "}
              <span>{briefing.flight.flight_number}</span>
            </>
          )}
          {briefing.aircraft && (
            <>
              {" · "}
              <span>{briefing.aircraft.tail_number}</span>
            </>
          )}
          {" · "}
          {stamp}
          {" · briefed by "}
          <span className="text-foreground">
            {briefing.briefed_by.full_name}
          </span>
        </p>
      </div>
      {briefing.worst_flight_category && (
        <FlightCategoryBadge
          category={briefing.worst_flight_category}
          size="lg"
        />
      )}
    </div>
  );
}

function MetarPanel({ briefing }: { briefing: WeatherBriefingResponse }) {
  const text = combineByKind(briefing.snapshot.items, "metar");
  if (!text) return null;
  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-semibold">METARs</h2>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background p-4 font-mono text-xs text-foreground">
        {text}
      </pre>
    </div>
  );
}

function TafPanel({ briefing }: { briefing: WeatherBriefingResponse }) {
  const text = combineByKind(briefing.snapshot.items, "taf");
  if (!text) return null;
  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-semibold">TAFs</h2>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background p-4 font-mono text-xs text-foreground">
        {text}
      </pre>
    </div>
  );
}

function Notes({ notes }: { notes: string | null }) {
  if (!notes) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-semibold">Dispatcher Notes</h2>
      <p className="whitespace-pre-wrap text-sm text-foreground">{notes}</p>
    </div>
  );
}

function combineByKind(
  items: WeatherReportResponse[],
  kind: "metar" | "taf",
): string {
  return items
    .filter((r) => r.kind === kind)
    .map((r) => r.raw)
    .join("\n\n");
}
