import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/ff/page-header";
import { listPartBases, listPartCategories } from "@/lib/api/maintenance";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { PartForm } from "../part-form";

/** /maintenance/inventory/new (#172). */
export default async function NewPartPage() {
  if (!hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF)) redirect("/maintenance/inventory");
  const [categories, bases] = await Promise.all([listPartCategories(), listPartBases().catch(() => [])]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Add Part" back={{ href: "/maintenance/inventory", label: "Inventory" }} />
      <div className="rounded-lg border border-border bg-card p-4">
        <PartForm part={null} categories={categories} bases={bases} />
      </div>
    </div>
  );
}
