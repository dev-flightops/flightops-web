import { PlaceholderDashboard } from "@/components/dashboards/placeholder-dashboard";

export default function SystemHealthDashboardPage() {
  return (
    <PlaceholderDashboard
      slug="system-health"
      title="System Health"
      subtitle="Service uptime, request latency, and integration status"
      intro="Operator-facing view of the platform itself — service availability, API latency, queue depth, third-party integration health (Garmin, weather feeds, ARINC). Different from the role dashboards: this answers 'is the system working?' not 'how are operations going?'"
      availableAfter="Month 4 — observability + status-page integration"
      upcomingMetrics={[
        "Per-service uptime (auth, ops, weather, crew, maintenance) over 24h",
        "Request latency p50 / p95 / p99 by route",
        "Background job queue depth + dead-letter counts",
        "Third-party integration status (Garmin, AAWU, NOAA, NOTAM feeds)",
        "Recent deployments + rollback button",
        "Error rate by service + top-5 error messages",
      ]}
    />
  );
}
