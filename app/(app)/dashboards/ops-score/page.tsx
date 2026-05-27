import { Gauge } from "lucide-react";

import { PlaceholderDashboard } from "@/components/dashboards/placeholder-dashboard";

export default function OpsScoreDashboardPage() {
  return (
    <PlaceholderDashboard
      title="Ops Score"
      icon={<Gauge className="h-5 w-5" />}
      intro="On-time performance, completion rate, and dispatch efficiency."
      availableAfter="Month 2 — flight following adds ATD/ATA timestamps"
      upcomingMetrics={[
        "On-time departure rate (ATD within 15 min of STD)",
        "Completion rate (released → completed without cancellation)",
        "Dispatch release latency (time from creation to release)",
        "Average daily release count vs target",
        "Per-aircraft utilization (hours flown vs hours available)",
      ]}
    />
  );
}
