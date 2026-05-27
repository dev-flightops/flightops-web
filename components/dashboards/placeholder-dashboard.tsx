import Link from "next/link";
import { CalendarClock, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PlaceholderDashboardProps {
  title: string;
  eyebrow?: string;
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
  eyebrow = "Insights",
  icon,
  intro,
  availableAfter,
  upcomingMetrics,
}: PlaceholderDashboardProps) {
  return (
    <main className="container py-10">
      <Link href="/dashboards" className="inline-block">
        <Button variant="ghost" size="sm" className="mb-4 -ml-3">
          <ChevronLeft className="h-4 w-4" />
          Dashboards
        </Button>
      </Link>

      <header className="mb-8 space-y-1">
        <div className="flex items-center gap-2 text-primary">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </header>

      <section className="rounded-lg border border-dashed border-border bg-muted/20 p-8">
        <div className="flex items-start gap-4">
          <CalendarClock className="h-6 w-6 flex-shrink-0 text-muted-foreground" />
          <div className="space-y-3">
            <p className="font-medium">
              Available after <span className="text-primary">{availableAfter}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              The underlying data this dashboard needs is being built in a future
              story. When it lands, this page will show:
            </p>
            <ul className="ml-1 space-y-1.5 text-sm">
              {upcomingMetrics.map((metric) => (
                <li
                  key={metric}
                  className="before:mr-2 before:text-primary before:content-['→']"
                >
                  {metric}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
