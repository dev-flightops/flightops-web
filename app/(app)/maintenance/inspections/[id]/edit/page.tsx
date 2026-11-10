import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/ff/page-header";
import { ApiError } from "@/lib/api/client";
import { getInspection, type InspectionDetail } from "@/lib/api/inspections";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { InspectionForm } from "../../inspection-form";
import { inspectionFormOptions } from "../../options";

/** /maintenance/inspections/[id]/edit (#178): its details, while it's being worked. */
export default async function EditInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF)) redirect(`/maintenance/inspections/${id}`);
  let inspection: InspectionDetail;
  try {
    inspection = await getInspection(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    throw err;
  }
  if (inspection.status === "signed_off" || inspection.status === "cancelled") {
    redirect(`/maintenance/inspections/${id}`);
  }
  const options = await inspectionFormOptions();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Edit Inspection"
        description={`${inspection.tail_number} · ${inspection.title}`}
        back={{ href: `/maintenance/inspections/${id}`, label: inspection.title }}
      />
      <div className="rounded-lg border border-border bg-card p-4">
        <InspectionForm inspection={inspection} {...options} />
      </div>
    </div>
  );
}
