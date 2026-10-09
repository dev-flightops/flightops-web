import { redirect } from "next/navigation";

import { listCompanies, type Company } from "@/lib/api/platform";
import { clearPlatformSession, getPlatformSession } from "@/lib/api/platform-session";

import { platformLogoutAction } from "./actions";
import { CompanyStatusButton } from "./company-status-button";
import { CreateCompanyForm } from "./create-company-form";

export const dynamic = "force-dynamic";

/**
 * /platform (#63): every operator company, from legacy's /owner/companies.
 * Create one with its first Exec Admin; suspend one that should lose
 * access, or bring it back. For platform administrators only: the admin
 * service refuses every other kind of token.
 */
export default async function PlatformCompaniesPage() {
  const session = await getPlatformSession();
  if (!session) redirect("/platform/login");

  const result = await listCompanies();
  if (!result.ok && result.status === 401) {
    await clearPlatformSession();
    redirect("/platform/login");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            Platform Administration
          </div>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Companies</h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{session.full_name}</span>
          <a href="/platform/password" className="font-semibold text-foreground/80 hover:underline">
            Change Password
          </a>
          <form action={platformLogoutAction}>
            <button type="submit" className="font-semibold text-foreground/80 hover:underline">
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <CreateCompanyForm />

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          All Companies
        </h2>
        {result.ok ? (
          <CompanyTable companies={result.body.items} />
        ) : (
          <div role="alert" className="rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red">
            {`The companies couldn't be loaded (HTTP ${result.status}). Refresh to try again.`}
          </div>
        )}
      </section>
    </div>
  );
}

function CompanyTable({ companies }: { companies: Company[] }) {
  if (companies.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No companies yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/60 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Company</th>
            <th className="px-3 py-2.5 font-semibold">Short Name</th>
            <th className="px-3 py-2.5 text-right font-semibold">Staff</th>
            <th className="px-3 py-2.5 font-semibold">Created</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {companies.map((c) => (
            <tr key={c.id} className="hover:bg-accent">
              <td className="px-3 py-2.5 font-medium">{c.name}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">{c.slug}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{c.staff}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleDateString("en-US", { timeZone: "UTC", dateStyle: "medium" })}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                {c.is_active ? (
                  <span className="rounded border border-status-green/40 bg-status-green/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-status-green">
                    Active
                  </span>
                ) : (
                  <span className="rounded border border-status-red/40 bg-status-red/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-status-red">
                    Suspended
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <CompanyStatusButton companyId={c.id} name={c.name} active={c.is_active} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
