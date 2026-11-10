import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/ff/page-header";
import { ApiError } from "@/lib/api/client";
import { getVendor, listVendorTypes, type MxVendor } from "@/lib/api/mx-vendors";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { VendorForm } from "../../vendor-form";

/** /maintenance/vendors/[id]/edit (#178). */
export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF)) redirect("/maintenance/vendors");
  let vendor: MxVendor;
  try {
    vendor = await getVendor(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    throw err;
  }
  const types = await listVendorTypes();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Edit Vendor" description={vendor.name} back={{ href: "/maintenance/vendors", label: "Vendors" }} />
      <div className="rounded-lg border border-border bg-card p-4">
        <VendorForm vendor={vendor} types={types} />
      </div>
    </div>
  );
}
