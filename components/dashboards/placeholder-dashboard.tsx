import { CalendarClock } from "lucide-react";

import { Breadcrumb } from "@/components/ui/breadcrumb";

interface PlaceholderDashboardProps {
  title: string;
  icon: React.ReactNode;
  /** Short one-line summary of what this dashboard will eventually show. */
  intro: string;
  /** Month / story when the underlying data will be ready. */
  availableAfter: string;
  /** Bullet list of metrics this dashboard will display. */
  upcomingMetrics: string[];
}

export function PlaceholderDashboard({
  title,
  icon,
  intro,
  availableAfter,
  upcomingMetrics,
}: PlaceholderDashboardProps) {
  return (
    <div className="container py-6">
      <header className="mb-5">
        <Breadcrumb
          icon={icon}
          segments={[
            { label: "Dashboards", href: "/dashboards" },
            { label: title },
          ]}
        />
        <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{intro}</p>
      </header>

      <section className="rounded-xl border border-dashed border-border bg-muted/20 p-6">
        <div className="flex items-start gap-4">
          <CalendarClock className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Available after <span className="text-status-blue">{availableAfter}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              The underlying data this dashboard needs is being built in a future
              story. When it lands, this page will show:
            </p>
            <ul className="ml-1 space-y-1.5 text-xs">
              {upcomingMetrics.map((metric) => (
                <li
                  key={metric}
                  className="before:mr-2 before:text-status-blue before:content-['→']"
                >
                  {metric}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
