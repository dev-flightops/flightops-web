import { MaintenanceShell } from "@/components/maintenance/subpage-shell";

export default function AvailabilityPage() {
  return (
    <MaintenanceShell
      title="Fleet Availability"
      subtitle="Aircraft status across the fleet — airworthy · grounded · fuel hold · out of service"
      ctas={[{ label: "Export" }]}
      emptyText="Availability grid renders once the maintenance-service exposes the fleet-status roll-up. Today the per-aircraft status lives on /maintenance (Fleet tab)."
      backendHint="Fleet-wide availability roll-up ships with the maintenance-service (M2 backend)"
    />
  );
}
