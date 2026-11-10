import type { CertType, PartTransactionType } from "@/lib/api/maintenance";

/** "5" or "2.5": stock is mostly whole, and a ".00" on every row is noise. */
export function formatQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/0$/, "");
}

/** "$12.50", or a dash with no cost on file. */
export function formatCost(cost: number | null): string {
  return cost == null ? "—" : `$${cost.toFixed(2)}`;
}

/** "Nov 5, 2026" from "2026-11-05", which is a day and has no time zone. */
export function dayLabel(day: string | null): string {
  if (!day) return "—";
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export const TXN_LABEL: Record<PartTransactionType, string> = {
  received: "Received",
  issued: "Issued",
  returned: "Returned",
  adjustment: "Adjustment",
  shipped: "Shipped",
};

export const CERT_LABEL: Record<CertType, string> = {
  ap: "A&P",
  ia: "IA",
  repairman: "Repairman",
};

export function certLabel(type: string | null | undefined): string {
  return type && type in CERT_LABEL ? CERT_LABEL[type as CertType] : "—";
}
