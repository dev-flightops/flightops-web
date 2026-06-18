import { SettingsMilestonePlaceholder } from "@/components/settings/milestone-placeholder";

export default function SettingsLoadTeamsPage() {
  return (
    <SettingsMilestonePlaceholder
      breadcrumb="Load Teams"
      title="Load Teams"
      subtitle="Named groups of ramp staff per base for fast assignment from the Ramp Ops board."
      availableAfter="M3 — crew-service"
      upcomingFields={[
        "Team roster per base (one team can span multiple bases)",
        "Default lead + members; drag-and-drop reassignment",
        "Per-team SLA targets (turn time, fueling cadence)",
        "Audit log of which team handled which flight",
      ]}
    />
  );
}
