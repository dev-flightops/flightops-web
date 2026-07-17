import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { listUsers } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

import { OpenCapaForm } from "./open-form";

const MANAGE_ROLES = new Set(["safety_officer", "exec_admin"]);

/**
 * /safety/actions/open — Open a CAPA against a hazard or incident.
 *
 * Landed on with `?source_type=hazard|incident&source_id=<uuid>` from
 * the source detail page's CAPA panel. Only Safety Officer + Exec
 * Admin can hit; other roles get redirected to /safety/actions/mine.
 *
 * Owner picker is populated with every active user in the tenant so
 * the CAPA can be assigned to anyone. Filtering to specific roles
 * would be premature — Part 5 SMS doesn't restrict CAPA ownership
 * to a role class.
 */
export default async function OpenCapaPage({
  searchParams,
}: {
  searchParams: Promise<{ source_type?: string; source_id?: string }>;
}) {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  if (![...roles].some((r) => MANAGE_ROLES.has(r))) {
    redirect("/safety/actions/mine");
  }

  const params = await searchParams;
  const sourceType = params.source_type;
  const sourceId = params.source_id;
  if (
    !sourceId ||
    (sourceType !== "hazard" && sourceType !== "incident")
  ) {
    notFound();
  }

  let users: Awaited<ReturnType<typeof listUsers>>["items"] = [];
  try {
    const response = await listUsers();
    // Only offer active users as owners — a deactivated user shouldn't
    // pick up a CAPA.
    users = response.items.filter((u) => u.is_active);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    users = [];
  }

  const backHref =
    sourceType === "hazard"
      ? `/safety/${sourceId}`
      : `/safety/incidents/${sourceId}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href={backHref} className="hover:text-foreground">
            ← Back to {sourceType}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Open a Corrective Action
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track the follow-through work needed to prevent this{" "}
          {sourceType} from recurring. Assign to an owner and give it a
          due date.
        </p>
      </header>

      <OpenCapaForm
        sourceType={sourceType}
        sourceId={sourceId}
        users={users.map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
        }))}
      />
    </div>
  );
}
