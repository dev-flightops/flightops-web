import { apiFetch, ApiError } from "@/lib/api/client";
import { isValidIsoDay } from "@/lib/iso-day";

export async function GET(request: Request): Promise<Response> {
  const search = new URL(request.url).searchParams;
  const start = search.get("start");
  const end = search.get("end");
  const customer = search.get("customer");
  if (!isValidIsoDay(start) || !isValidIsoDay(end) || start > end ||
      (customer && !/^[0-9a-f-]{36}$/i.test(customer))) {
    return Response.json({ error: "Choose a valid invoice date range and customer." }, { status: 400 });
  }
  const params = new URLSearchParams({ start, end });
  if (customer) params.set("customer_id", customer);
  try {
    const csv = await apiFetch<string>(`/billing/customer-invoices/export.csv?${params}`, { parseAs: "text" });
    return new Response(csv, { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="peregrine_invoices_${start}_${end}.csv"`,
      "Cache-Control": "no-store",
    } });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 503;
    const error = status === 413 ? "Too many invoices. Choose a narrower date range." :
      status === 403 ? "Invoice export is limited to accounting roles." :
      status === 401 ? "Your session expired. Sign in again." : "Invoice export is unavailable. Try again in a moment.";
    return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
