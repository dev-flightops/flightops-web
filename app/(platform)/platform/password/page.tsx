import Link from "next/link";
import { redirect } from "next/navigation";

import { getPlatformSession } from "@/lib/api/platform-session";

import { PasswordForm } from "./password-form";

/** /platform/password (#63): replace the one-time password, or any other. */
export default async function PlatformPasswordPage() {
  const session = await getPlatformSession();
  if (!session) redirect("/platform/login");

  return (
    <div className="mx-auto max-w-sm px-4 sm:px-6 py-8">
      <div className="mb-4 text-xs">
        <Link href="/platform" className="text-muted-foreground hover:text-foreground">
          ← Companies
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Change Password</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">{session.email}</p>
      <div className="rounded-lg border border-border bg-card p-5">
        <PasswordForm />
      </div>
    </div>
  );
}
