import { MaintenanceShell } from "@/components/maintenance/subpage-shell";

export default function BatchTracePage() {
  return (
    <MaintenanceShell
      title="Batch Trace"
      subtitle="Trace parts and materials by lot / batch number"
      ctas={[{ label: "Search" }]}
      emptyText="Enter a lot or batch number once the maintenance-service exposes the batch registry. Batch trace links parts to work orders and airworthiness records for FAA audit."
      backendHint="Batch Trace ships with the maintenance-service (M2 backend)"
    />
  );
}
