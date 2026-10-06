/**
 * The dispatch packet PDF (#52), in the operator's layout: auth-proxying,
 * since a browser <a href> can't attach a Bearer header.
 *
 * ops renders it, but only the weather service fetches the AAWU charts,
 * so this brings them along, with the flight's current weather for a
 * flight that has no packet kept at release (unreleased: printed as a
 * draft; released before packets were kept: printed as of now, and the
 * packet says so).
 */

import { auth } from "@/auth";
import { packetWeatherFor } from "@/lib/api/dispatch-risk";

// Gathering the weather and charts can take a few seconds on a cold cache.
export const maxDuration = 30;

const CHARTS = ["icing", "turbulence"] as const;
const CHART_TIMEOUT_MS = 8000;

/** An AAWU chart as base64, or null (the packet prints it as unavailable). */
async function chart(
  apiUrl: string,
  headers: Record<string, string>,
  name: (typeof CHARTS)[number],
): Promise<string | null> {
  try {
    const response = await fetch(`${apiUrl}/weather/aawu-charts/${name}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(CHART_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ flightId: string }> },
) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { flightId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const headers = { Authorization: `Bearer ${session.access_token}` };
  const [weather, ...images] = await Promise.all([
    packetWeatherFor(flightId),
    ...CHARTS.map((name) => chart(apiUrl, headers, name)),
  ]);
  const charts = Object.fromEntries(
    CHARTS.flatMap((name, i) => (images[i] ? [[name, images[i]]] : [])),
  );

  const response = await fetch(`${apiUrl}/ops/flights/${flightId}/packet.pdf`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ charts, ...(weather && { weather }) }),
    cache: "no-store",
  });

  if (!response.ok) {
    return new Response(`Backend returned ${response.status}`, {
      status: response.status,
    });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        response.headers.get("content-disposition") ??
        `inline; filename="flight-${flightId}-dispatch-packet.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
