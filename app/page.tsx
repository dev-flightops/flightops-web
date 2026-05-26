import { Plane } from "lucide-react";

export default function Home() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-12">
      <div className="flex items-center gap-3">
        <Plane className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-semibold tracking-tight">
          Peregrine FlightOps
        </h1>
      </div>
      <p className="max-w-xl text-center text-muted-foreground">
        Multi-tenant Part 135 aviation dispatch and operations platform.
        Story 1 scaffold — modules ship monthly.
      </p>
      <div className="rounded-md border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
        API target:{" "}
        <code className="font-mono">
          {process.env.NEXT_PUBLIC_API_URL ?? "not configured"}
        </code>
      </div>
    </main>
  );
}
