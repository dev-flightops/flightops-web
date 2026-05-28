import Link from "next/link";
import {
  Briefcase,
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
    description: "Multi-day plan, exception list",
    icon: <LayoutDashboard className="h-5 w-5" />,
    href: "/dashboards/director-ops",
  },
  {
    slug: "chief-pilot",
    title: "Chief Pilot",
    description: "Pilot currency, duty/rest, qualifications (M3)",
    icon: <ShieldCheck className="h-5 w-5" />,
    href: "/dashboards/chief-pilot",
  },
  {
    slug: "ops-score",
    title: "Ops Score",
    description: "On-time performance, completion rate (M2)",
    icon: <Gauge className="h-5 w-5" />,
    href: "/dashboards/ops-score",
  },
  {
    slug: "station",
    title: "Station",
    description: "Per-station traffic; fuel + ground times in M2",
    icon: <MapPin className="h-5 w-5" />,
    href: "/dashboards/station",
  },
];

export default function DashboardsIndexPage() {
  return (
    <div className="container py-6">
      <header className="mb-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em]">
            Operations · Dashboards
          </span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">Dashboards</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Role-tailored views of operations. Four live with current data; two
          placeholders explain what lands in M2-M3.
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
    </div>
  );
}
