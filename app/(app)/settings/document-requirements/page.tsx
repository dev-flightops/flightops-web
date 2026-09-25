import Link from "next/link";

import { listRoles } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  listDocumentRequirements,
  type DocumentRequirementRow,
} from "@/lib/api/employee-documents";
import type { RoleSummary } from "@/lib/api/types";

import { RequirementsTable } from "./requirements-table";

/**
 * /settings/document-requirements — the documents the operation
 * requires of its staff.
 *
 * Legacy keeps this under training as `documents_admin.html`. It sits
 * in Settings here because it is company configuration, not a per-
 * person record: every employee's Documents tab is built from this
 * list, and nothing on it is about an individual.
 *
 * Exec-admin on the service for writes. Reads are open, because an
 * employee's own checklist has to render the requirement names.
 */
export const dynamic = "force-dynamic";

export default async function DocumentRequirementsPage() {
  let requirements: DocumentRequirementRow[] = [];
  let roles: RoleSummary[] = [];
  let loadError: string | null = null;

  try {
    const [reqResp, roleResp] = await Promise.all([
      // Inactive included: the page offers putting one back in use, so
      // it has to be able to show them.
      listDocumentRequirements({ includeInactive: true }),
      listRoles(),
    ]);
    requirements = reqResp.items;
    roles = roleResp.roles;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You need Exec Admin to manage document requirements."
          : "Document requirements unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center text-xs">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground"
        >
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="font-semibold text-primary">
          Document requirements
        </span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Document requirements
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The documents your operation requires of its staff. Each one
          appears on the Documents tab of every employee it applies to.
        </p>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : (
        <RequirementsTable requirements={requirements} roles={roles} />
      )}
    </div>
  );
}
