import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/ff/page-header";
import { ApiError } from "@/lib/api/client";
import { getPart, listPartBases, listPartCategories, type PartDetail } from "@/lib/api/maintenance";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { PartForm } from "../../part-form";

/** /maintenance/inventory/[id]/edit (#172). */
export default async function EditPartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF)) redirect(`/maintenance/inventory/${id}`);
  let part: PartDetail;
  try {
    part = await getPart(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    throw err;
  }
  const [categories, bases] = await Promise.all([listPartCategories(), listPartBases().catch(() => [])]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Edit Part"
        description={part.part_number}
        back={{ href: `/maintenance/inventory/${id}`, label: part.part_number }}
      />
      <div className="rounded-lg border border-border bg-card p-4">
        <PartForm part={part} categories={categories} bases={bases} />
      </div>
    </div>
  );
}
