import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/ff/page-header";
import { listVendorTypes } from "@/lib/api/mx-vendors";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { VendorForm } from "../vendor-form";

/** /maintenance/vendors/new (#178). */
export default async function NewVendorPage() {
  if (!hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF)) redirect("/maintenance/vendors");
  const types = await listVendorTypes();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Add Vendor" back={{ href: "/maintenance/vendors", label: "Vendors" }} />
      <div className="rounded-lg border border-border bg-card p-4">
        <VendorForm vendor={null} types={types} />
      </div>
    </div>
  );
}
