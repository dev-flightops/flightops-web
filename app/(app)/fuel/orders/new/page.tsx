import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { listFuelSuppliers, listFuelTypes } from "@/lib/api/ground";
import { listAircraft } from "@/lib/api/ops";
import type {
  AircraftListItem,
  FuelSupplierResponse,
  FuelTypeResponse,
} from "@/lib/api/types";

import { NewFuelOrderForm } from "./new-order-form";

export default async function NewFuelOrderPage() {
  let suppliers: FuelSupplierResponse[] = [];
  let fuelTypes: FuelTypeResponse[] = [];
  let fleet: AircraftListItem[] = [];
  let loadError: string | null = null;

  try {
    const [s, t, a] = await Promise.all([listFuelSuppliers(), listFuelTypes(), listAircraft()]);
    suppliers = s.items;
    fuelTypes = t.items;
    // An order is for an aircraft in service (#156): the client's N208TW
    // wasn't in the fleet, and N301PA was grounded.
    fleet = a.items.filter((x) => x.is_active);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Couldn't load the fuel directory. The form still works — pickers may be empty.";
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/fuel/orders"
        className={cn(linkCaps, "text-muted-foreground hover:text-foreground mb-4")}
      >
        <span aria-hidden>‹</span> Fuel Orders
      </Link>
      <h1 className="page-title mb-6 border-b border-border pb-5">Order Fuel</h1>

      {loadError && (
        <div
          role="alert"
          className="mb-4 notice notice-yellow"
        >
          {loadError}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <NewFuelOrderForm suppliers={suppliers} fuelTypes={fuelTypes} fleet={fleet} />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        A supplier with a portal login sees the order there as soon as it&apos;s
        placed. Nothing else is sent: no email or text goes out, so call
        a supplier without one. Status flows ordered → confirmed → fueled.
      </p>
    </div>
  );
}
