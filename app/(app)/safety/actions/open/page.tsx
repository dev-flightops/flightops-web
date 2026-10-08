import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/roles";
import { MANAGE_ROLES } from "@/lib/safety-roles";
import { listStaff } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  CAPA_SOURCE_LABELS,
  CAPA_SOURCE_TYPES,
  type CapaSourceType,
  capaSourceHref,
} from "@/lib/api/safety";

import { OpenCapaForm } from "./open-form";

/**
 * /safety/actions/open — Open a CAPA against a hazard, an incident or a
 * safety report.
 *
 * Landed on with `?source_type=hazard|incident|safety_report&source_id=<uuid>` from
 * the source detail page's CAPA panel. Only Safety Officer + Exec
 * Admin can hit; other roles get redirected to /safety/actions/mine.
 *
 * Owner picker is populated with every active staff member, from the
 * staff directory (#60), so the CAPA can be assigned to anyone.
 * Filtering to specific roles would be premature — Part 5 SMS doesn't
 * restrict CAPA ownership to a role class. It read the Exec Admin's
 * user list until #60, which left the Safety Officer no one to pick.
 */
export default async function OpenCapaPage({
  searchParams,
}: {
  searchParams: Promise<{ source_type?: string; source_id?: string }>;
}) {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  if (!hasAnyRole([...roles], MANAGE_ROLES)) {
    redirect("/safety/actions/mine");
  }

  const params = await searchParams;
  const sourceType = CAPA_SOURCE_TYPES.find((t) => t === params.source_type) as
    | CapaSourceType
    | undefined;
  const sourceId = params.source_id;
  if (!sourceId || !sourceType) {
    notFound();
  }
  const sourceLabel = CAPA_SOURCE_LABELS[sourceType].toLowerCase();

  let users: Awaited<ReturnType<typeof listStaff>>["items"] = [];
  try {
    // Active staff only: a deactivated user shouldn't pick up a CAPA.
    users = (await listStaff()).items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    users = [];
  }

  const backHref = capaSourceHref(sourceType, sourceId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href={backHref} className="hover:text-foreground">
            ← Back to {sourceLabel}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Open a Corrective Action
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track the follow-through work needed to prevent this{" "}
          {sourceLabel} from recurring. Assign to an owner and give it a
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
