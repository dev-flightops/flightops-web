import { MaintenanceShell } from "@/components/maintenance/subpage-shell";

export default function MxClockPage() {
  return (
    <MaintenanceShell
      title="MX Clock"
      subtitle="0 mechanics on the clock · 0h logged this week"
      ctas={[{ label: "Filter" }]}
      emptyText="No time punches recorded. Mechanics clock in against work orders here; hours roll up to payroll and per-aircraft labour totals."
      backendHint="MX Clock ships with the maintenance-service (M2 backend)"
    />
  );
}
