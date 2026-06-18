import { SettingsMilestonePlaceholder } from "@/components/settings/milestone-placeholder";

export default function SettingsCurrencyPage() {
  return (
    <SettingsMilestonePlaceholder
      breadcrumb="Currency"
      title="Crew Currency Items"
      subtitle="Define the recurring checks (medical, BFR, line check, IOE) the chief-pilot dashboard tracks."
      availableAfter="M3 — crew-service"
      upcomingFields={[
        "Currency item catalog (Medical, Part 135.293 line check, BFR, IOE, RVSM, etc.)",
        "Renewal cadence per item (calendar month, last-day-of-month, every-N-months)",
        "Warning thresholds (advisory at 30 days, expired at day-of)",
        "Per-role applicability (PIC vs SIC vs non-pilot)",
      ]}
    />
  );
}
