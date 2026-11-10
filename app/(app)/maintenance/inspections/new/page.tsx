import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/ff/page-header";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { InspectionForm } from "../inspection-form";
import { inspectionFormOptions } from "../options";

/** /maintenance/inspections/new (#178), legacy's inspection_form.html. */
export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ aircraft?: string }>;
}) {
  if (!hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF)) redirect("/maintenance/inspections");
  const { aircraft: aircraftId } = await searchParams;
  const options = await inspectionFormOptions();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="New Inspection"
        description="The aircraft's total time is taken when it starts. Add the checklist on the next page."
        back={{ href: "/maintenance/inspections", label: "Inspections" }}
      />
      <div className="rounded-lg border border-border bg-card p-4">
        <InspectionForm inspection={null} defaultAircraftId={aircraftId} {...options} />
      </div>
    </div>
  );
}
