import Link from "next/link";
import {
  Briefcase,
  ChevronLeft,
  Gauge,
  LayoutDashboard,
  MapPin,
  Plane,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DashboardEntry {
  slug: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
}

const DASHBOARDS: DashboardEntry[] = [
  {
    slug: "executive",
    title: "Executive",
    description: "Weekly KPIs, release velocity, fleet status",
    icon: <Briefcase className="h-5 w-5" />,
    href: "/dashboards/executive",
  },
  {
    slug: "dispatcher",
    title: "Dispatcher",
    description: "Today's flights, release queue, recent activity",
    icon: <Plane className="h-5 w-5" />,
    href: "/dashboards/dispatcher",
  },
  {
    slug: "director-ops",
    title: "Director of Operations",
    description: "Multi-day plan, crew utilization, exception list",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    slug: "chief-pilot",
    title: "Chief Pilot",
    description: "Pilot currency, duty/rest, qualifications",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    slug: "ops-score",
    title: "Ops Score",
    description: "On-time performance, completion rate, dispatch efficiency",
    icon: <Gauge className="h-5 w-5" />,
  },
  {
    slug: "station",
    title: "Station",
    description: "Per-station traffic, fuel, ground times",
    icon: <MapPin className="h-5 w-5" />,
  },
];

export default function DashboardsIndexPage() {
  return (
    <main className="container py-10">
      <Link href="/" className="inline-block">
        <Button variant="ghost" size="sm" className="mb-4 -ml-3">
          <ChevronLeft className="h-4 w-4" />
          Home
        </Button>
      </Link>

      <header className="mb-8 space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Insights
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboards</h1>
        <p className="text-sm text-muted-foreground">
          Role-tailored views of operations. Two live now; four scheduled for
          Month 1.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DASHBOARDS.map((d) => (
          <Card key={d.slug}>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">{d.icon}</div>
              <CardTitle>{d.title}</CardTitle>
              <CardDescription>{d.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {d.href ? (
                <Link href={d.href}>
                  <Button size="sm" variant="outline">
                    Open
                  </Button>
                </Link>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  Coming soon
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
