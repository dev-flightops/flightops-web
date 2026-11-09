import Link from "next/link";

import { auth } from "@/auth";
import { buttonSolid, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { ApiError } from "@/lib/api/client";
import { listVendors, type MxVendor } from "@/lib/api/mx-vendors";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

/**
 * /maintenance/vendors (#178), legacy's templates/maintenance/vendors.html:
 * the shops and suppliers maintenance works with, by type then name. Legacy's
 * cards are rows here; the fields are its.
 */

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const canEdit = hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF);
  let vendors: MxVendor[] | null = null;
  let loadError: string | null = null;
  try {
    vendors = await listVendors();
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Your session expired — please sign in again."
        : "The vendor list is unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Vendors & MROs"
        back={{ href: "/maintenance", label: "Fleet" }}
        description={vendors ? `${vendors.length} vendor${vendors.length === 1 ? "" : "s"}` : null}
        actions={
          canEdit ? (
            <Link href="/maintenance/vendors/new" className={buttonSolid}>
              + Add Vendor
            </Link>
          ) : null
        }
      />
      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : vendors && vendors.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="ff-table w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                <th>FAA Cert</th>
                {canEdit ? (
                  <th>
                    <span className="sr-only">Edit</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="font-semibold">
                    {v.name}
                    {v.address ? <span className="block text-xs font-normal text-muted-foreground">{v.address}</span> : null}
                  </td>
                  <td className="text-xs text-muted-foreground">{v.type_label}</td>
                  <td>{v.contact_name ?? "—"}</td>
                  <td className="whitespace-nowrap">
                    {v.phone ? (
                      <a href={`tel:${v.phone}`} className="hover:underline">
                        {v.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {v.email ? (
                      <a href={`mailto:${v.email}`} className="break-all hover:underline">
                        {v.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="font-mono text-xs">{v.faa_cert ?? "—"}</td>
                  {canEdit ? (
                    <td className="text-right">
                      <Link href={`/maintenance/vendors/${v.id}/edit`} className={linkCaps}>
                        Edit<span className="sr-only"> {v.name}</span> <span aria-hidden>›</span>
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          action={
            canEdit ? (
              <Link href="/maintenance/vendors/new" className={buttonSolid}>
                Add First Vendor
              </Link>
            ) : undefined
          }
        >
          No vendors yet.
        </EmptyState>
      )}
    </div>
  );
}
