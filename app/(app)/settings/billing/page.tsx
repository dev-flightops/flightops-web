import { SettingsMilestonePlaceholder } from "@/components/settings/milestone-placeholder";

export default function SettingsBillingPage() {
  return (
    <SettingsMilestonePlaceholder
      breadcrumb="Billing"
      title="Billing & Subscription"
      subtitle="Plan, seat count, invoices, and the payment method on file for the FlightOps subscription."
      availableAfter="M3 — billing-service"
      upcomingFields={[
        "Current plan + seat utilization (N of M seats used)",
        "Upcoming invoice preview + line-item breakdown",
        "Payment method (card on file, ACH for higher-tier plans)",
        "Past invoice history with PDF download",
      ]}
    />
  );
}
