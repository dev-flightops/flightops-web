import { MaintenanceShell } from "@/components/maintenance/subpage-shell";

export default function RtsQueuePage() {
  return (
    <MaintenanceShell
      title="Return to Service Queue"
      subtitle="0 aircraft awaiting RTS approval"
      ctas={[{ label: "Filter" }]}
      emptyText="No aircraft in the RTS queue. Aircraft appear here once their work orders close and they need dual sign-off before returning to service."
      backendHint="RTS queue ships with the maintenance-service (M2 backend)"
    />
  );
}
