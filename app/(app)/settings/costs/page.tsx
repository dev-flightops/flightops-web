import { SettingsMilestonePlaceholder } from "@/components/settings/milestone-placeholder";

export default function SettingsCostsPage() {
  return (
    <SettingsMilestonePlaceholder
      breadcrumb="Costs"
      title="Operating Costs"
      subtitle="Per-airframe hourly cost model, per-base fuel pricing, and the cost-per-flight-hour calculator."
      availableAfter="M4 — operating-cost service"
      upcomingFields={[
        "Per-airframe hourly cost table (TBO reserves, engine/prop reserves, insurance, pilot duty + flight cost)",
        "Per-base fuel pricing grid (override the Spider Tracks/contract default)",
        "Loading fee + beach vehicle tier calculator",
        "Cost-per-flight-hour calculator for charter quotes + profitability",
      ]}
    />
  );
}
