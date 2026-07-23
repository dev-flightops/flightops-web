import { MaintenanceShell } from "@/components/maintenance/subpage-shell";

export default function InventoryPage() {
  return (
    <MaintenanceShell
      title="Inventory"
      subtitle="0 parts · 0 low-stock · 0 back-ordered"
      ctas={[
        { label: "Filter" },
        { label: "+ New Part", primary: true },
      ]}
      emptyText="No parts on file yet. Add a part to start tracking stock levels, reorder points, and installation history."
      backendHint="Inventory ships with the maintenance-service (M2 backend)"
    />
  );
}
