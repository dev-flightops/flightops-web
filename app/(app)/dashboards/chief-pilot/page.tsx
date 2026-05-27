import { ShieldCheck } from "lucide-react";

import { PlaceholderDashboard } from "@/components/dashboards/placeholder-dashboard";

export default function ChiefPilotDashboardPage() {
  return (
    <PlaceholderDashboard
      title="Chief Pilot"
      icon={<ShieldCheck className="h-5 w-5" />}
      intro="Pilot currency, duty/rest, and qualifications at a glance."
      availableAfter="Month 3 — crew-service extraction"
      upcomingMetrics={[
        "Crew currency by aircraft type (recurrent due, medical expiry, type endorsements)",
        "FAR 135.265 / 135.267 duty + rest legality per pilot",
        "Active duty periods (who is on, who is resting)",
        "Pilot performance: flights flown last 30 days, on-time rate",
        "Drug & alcohol testing compliance status",
      ]}
    />
  );
}
