import { LogOut, Plane, Users, Wrench } from "lucide-react";

import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function Home() {
  const session = await auth();
  const apiTarget = process.env.NEXT_PUBLIC_API_URL ?? "not configured";

  return (
    <main className="container py-12">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <Plane className="h-9 w-9 text-primary" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Peregrine FlightOps</h1>
            <p className="text-sm text-muted-foreground">
              API target: <code className="font-mono">{apiTarget}</code>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCard
          icon={<Plane className="h-5 w-5" />}
          title="Dispatch"
          description="Releases, risk scoring, compliance, weather"
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
    </main>
  );
}

function ModuleCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">{icon}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" variant="outline">
          Open
        </Button>
      </CardContent>
    </Card>
  );
}
