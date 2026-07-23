import { MaintenanceShell } from "@/components/maintenance/subpage-shell";

export default function ExpirationPage() {
  return (
    <MaintenanceShell
      title="Expiration Tracking"
      subtitle="0 items expired · 0 due in 30 days · 0 due in 90 days"
      ctas={[
        { label: "Filter" },
        { label: "Export" },
      ]}
      emptyText="No tracked expiries. Life-limited parts, MEL items, and time-limited inspections surface here once the maintenance-service exposes the expiration roll-up."
      backendHint="Expiration roll-up ships with the maintenance-service (M2 backend)"
    />
  );
}
