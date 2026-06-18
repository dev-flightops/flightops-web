import { SettingsMilestonePlaceholder } from "@/components/settings/milestone-placeholder";

export default function SettingsPilotPayPage() {
  return (
    <SettingsMilestonePlaceholder
      breadcrumb="Pilot Pay"
      title="Pilot Pay Configuration"
      subtitle="Pay rates, per-diem, override rules, and the payroll export pipeline."
      availableAfter="M3 — crew-service + payroll integration"
      upcomingFields={[
        "Hourly + block-hour pay rate per seat (PIC / SIC) per airframe",
        "Per-diem rules (overnight, day-of, distance-from-base)",
        "Override + adjustment policies (training, ferry, deadhead)",
        "Payroll period close + CSV export to ADP / Gusto / QuickBooks",
      ]}
    />
  );
}
