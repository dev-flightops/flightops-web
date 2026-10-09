import { redirect } from "next/navigation";

import { getPlatformSession } from "@/lib/api/platform-session";

import { PlatformLoginForm } from "./login-form";

/**
 * /platform/login (#63): platform administrators sign in here, apart from
 * every operator's /login. Their accounts belong to no operator.
 */
export default async function PlatformLoginPage() {
  if (await getPlatformSession()) redirect("/platform");

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 sm:px-6 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Platform Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and suspend operator companies on Peregrine Flight Ops.
        </p>
      </header>
      <div className="rounded-lg border border-border bg-card p-5">
        <PlatformLoginForm />
      </div>
      <p className="mt-5 text-center text-[0.7rem] text-muted-foreground">
        Work for an operator?{" "}
        <a href="/login" className="font-semibold text-primary hover:underline">
          Sign in to your company →
        </a>
      </p>
    </div>
  );
}
