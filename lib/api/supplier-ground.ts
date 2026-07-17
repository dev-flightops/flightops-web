/**
 * M3-X-2 — Fuel-supplier-portal ground-service client. Parallel to
 * the sibling wrappers in lib/api/ground.ts for tenant users; these
 * go through supplierApiFetch so they read the supplier session
 * cookie instead of the Auth.js session.
 */

import type { FuelOrderListResponse, FuelOrderResponse } from "./types";
import { supplierApiFetch } from "./supplier-client";

export interface SupplierListOrdersParams {
  status?: string;
  baseCode?: string;
  limit?: number;
}

export async function supplierListOrders(
  params: SupplierListOrdersParams = {},
): Promise<FuelOrderListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.baseCode) search.set("base_code", params.baseCode);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return supplierApiFetch<FuelOrderListResponse>(
    `/ground/fuel/supplier/orders${qs}`,
  );
}

export async function supplierAcknowledgeOrder(
  orderId: string,
  confirmedByName: string,
  confirmedNote: string | null,
): Promise<FuelOrderResponse> {
  return supplierApiFetch<FuelOrderResponse>(
    `/ground/fuel/supplier/orders/${orderId}/acknowledge`,
    {
      method: "POST",
      body: JSON.stringify({
        confirmed_by_name: confirmedByName,
        confirmed_note: confirmedNote,
      }),
    },
  );
}

export interface SupplierFueledPayload {
  fueled_by_name: string;
  actual_quantity_gallons: number;
  discrepancy_reason?: string | null;
  invoice_pending?: boolean;
}

export async function supplierMarkFueled(
  orderId: string,
  payload: SupplierFueledPayload,
): Promise<FuelOrderResponse> {
  return supplierApiFetch<FuelOrderResponse>(
    `/ground/fuel/supplier/orders/${orderId}/fueled`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
