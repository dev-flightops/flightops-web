import { MaintenanceShell } from "@/components/maintenance/subpage-shell";

export default function WorkOrdersPage() {
  return (
    <MaintenanceShell
      title="Work Orders"
      subtitle="0 open · 0 in progress · 0 awaiting parts"
      ctas={[
        { label: "Filter" },
        { label: "+ New Work Order", primary: true },
      ]}
      emptyText="No work orders yet. Open one from a squawk or create a new work order to get started."
      backendHint="Work Orders ship with the maintenance-service (M2 backend)"
    />
  );
}
