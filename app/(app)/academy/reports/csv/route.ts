import { getAcademyReportCsv } from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

import { readReportSearch } from "../params";

/** Academy Reports' Export CSV: the report on the page, with its filters, as
 *  the academy service writes it. */
export async function GET(request: Request): Promise<Response> {
  const { report, filters, backwards } = readReportSearch(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (backwards) {
    return Response.json({ error: "The start date is after the end date." }, { status: 400 });
  }
  try {
    const csv = await getAcademyReportCsv(report, filters);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="academy_${report}_${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 503;
    const error =
      status === 403
        ? "Academy reports are for the Chief Pilot, the Director of Operations and Exec Admins."
        : status === 401
          ? "Your session expired. Sign in again."
          : "The report is unavailable. Try again in a moment.";
    return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
