import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listFuelSuppliers, listFuelTypes } from "@/lib/api/ground";
import type {
  FuelSupplierResponse,
  FuelTypeResponse,
} from "@/lib/api/types";

import { NewFuelOrderForm } from "./new-order-form";

export default async function NewFuelOrderPage() {
  let suppliers: FuelSupplierResponse[] = [];
  let fuelTypes: FuelTypeResponse[] = [];
  let loadError: string | null = null;

  try {
    const [s, t] = await Promise.all([listFuelSuppliers(), listFuelTypes()]);
    suppliers = s.items;
    fuelTypes = t.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Couldn't load the fuel directory. The form still works — pickers may be empty.";
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/fuel/orders"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        ← Fuel Orders
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Order Fuel</h1>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <NewFuelOrderForm suppliers={suppliers} fuelTypes={fuelTypes} />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        The supplier is notified on submit. Status flows ordered → confirmed →
        fueled. Real email delivery via ops-service (M3); today's notification
        payload is logged for audit.
      </p>
    </div>
  );
}
