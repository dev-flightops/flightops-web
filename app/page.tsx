import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  LayoutDashboard,
  LogOut,
  Plane,
  Users,
  Wrench,
} from "lucide-react";

import { auth, signOut } from "@/auth";
import { StatCard } from "@/components/dashboards/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getFlightStats } from "@/lib/api/ops";
import { formatDate } from "@/lib/utils";
import type { FlightStats } from "@/lib/api/types";

export default async function Home() {
  const session = await auth();

  // Live ops summary — degrades gracefully if the backend hiccups so the
  // home screen still works as a navigation shell.
  let stats: FlightStats | null = null;
  try {
    stats = await getFlightStats();
  } catch {
    stats = null;
  }

  return (
    <main className="container py-12">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <Plane className="h-9 w-9 text-primary" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Peregrine FlightOps
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toISOString().slice(0, 10)} (UTC)
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          <span className="text-muted-foreground">
            {session?.user?.email ?? "not signed in"}
          </span>
          {session?.roles?.length ? (
            <span className="text-xs text-muted-foreground">
              {session.roles.join(" · ")}
            </span>
          ) : null}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {stats && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Flights today"
              value={stats.today.total}
              hint={`${stats.today.released} released · ${stats.today.scheduled} scheduled`}
              icon={<Plane className="h-5 w-5" />}
            />
            <StatCard
              label="Released today"
              value={stats.today.released}
              icon={<CheckCircle2 className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Active aircraft"
              value={`${stats.aircraft_active}/${stats.aircraft_total}`}
              hint="ready for dispatch"
              icon={<Plane className="h-5 w-5" />}
            />
            <StatCard
              label="Last release"
              value={
                stats.last_release_at
                  ? formatDate(stats.last_release_at, { timeStyle: "short" })
                  : "—"
              }
              hint={
                stats.last_release_at
                  ? formatDate(stats.last_release_at, { dateStyle: "medium" })
                  : "no releases yet"
              }
              icon={<Clock className="h-5 w-5" />}
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={<Plane className="h-5 w-5" />}
            title="Dispatch"
            description="Releases, risk scoring, compliance, weather"
            href="/dispatch"
          />
          <ModuleCard
            icon={<LayoutDashboard className="h-5 w-5" />}
            title="Dashboards"
            description="Executive, Dispatcher, Director of Ops, Station"
            href="/dashboards"
          />
          <ModuleCard
            icon={<Wrench className="h-5 w-5" />}
            title="Maintenance"
            description="Fleet, work orders, MEL, RTS queue"
          />
          <ModuleCard
            icon={<Users className="h-5 w-5" />}
            title="Crew"
            description="Roster, duty/rest legality, payroll"
          />
        </div>
      </section>
    </main>
  );
}

function ModuleCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
}) {
  const action = href ? (
    <Link href={href}>
      <Button size="sm" variant="outline">
        Open
      </Button>
    </Link>
  ) : (
    <Button size="sm" variant="outline" disabled>
      Coming soon
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">{icon}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{action}</CardContent>
    </Card>
  );
}
