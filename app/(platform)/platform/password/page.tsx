import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ff/page-header";
import { getPlatformSession } from "@/lib/api/platform-session";

import { PasswordForm } from "./password-form";

/** /platform/password (#63): replace the one-time password, or any other. */
export default async function PlatformPasswordPage() {
  const session = await getPlatformSession();
  if (!session) redirect("/platform/login");

  return (
    <div className="mx-auto max-w-sm px-4 sm:px-6 py-8">
      <PageHeader
        back={{ href: "/platform", label: "Companies" }}
        title="Change Password"
        description={session.email}
      />
      <div className="rounded-lg border border-border bg-card p-5">
        <PasswordForm />
      </div>
    </div>
  );
}
