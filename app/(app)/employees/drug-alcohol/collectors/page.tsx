import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { StatusMark } from "@/components/ff/status-mark";
import { ApiError } from "@/lib/api/client";
import { listCollectors, type Collector } from "@/lib/api/drug-alcohol";

import { DatNav } from "../dat-nav";
import { CollectorForm } from "./collector-form";

/**
 * /employees/drug-alcohol/collectors, legacy's Collectors/MRO directory: the
 * collection sites, Medical Review Officers, laboratories and consortiums
 * the company's tests name. Whoever runs the program only.
 */

export const dynamic = "force-dynamic";

export default async function CollectorsPage() {
  let rows: Collector[] | null = null;
  let loadError: string | null = null;
  try {
    rows = (await listCollectors()).items;
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 403
        ? "The directory is for the program's DER, the alternate DER and the Exec Admins."
        : "The directory is unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Collectors, MROs and Labs"
        back={{ href: "/employees/drug-alcohol", label: "Drug & Alcohol" }}
        description="Collection sites, medical review officers, laboratories and consortiums the tests name"
      />
      <DatNav active="collectors" />
      {loadError || !rows ? (
        <Notice tone="yellow" role="alert">
          {loadError ?? "The directory is unavailable."}
        </Notice>
      ) : (
        <>
          {rows.length === 0 ? (
            <EmptyState className="mb-6">None yet. Add the collection site, MRO and lab you use.</EmptyState>
          ) : (
            <div className="mb-6 overflow-x-auto rounded-lg border border-border bg-card">
              <table className="ff-table w-full text-sm">
                <thead className="ff-thead">
                  <tr>
                    <th>What It Is</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className={c.is_active ? undefined : "text-muted-foreground"}>
                      <td className="text-xs">{c.kind_label}</td>
                      <td>
                        <span className="font-semibold">{c.name}</span>
                        {c.address ? <span className="block text-xs text-muted-foreground">{c.address}</span> : null}
                      </td>
                      <td className="text-xs">
                        {c.contact_name ?? "—"}
                        {c.email ? <span className="block text-muted-foreground">{c.email}</span> : null}
                      </td>
                      <td className="text-xs">
                        {c.phone ?? "—"}
                        {c.after_hours_phone ? <span className="block text-muted-foreground">After hours {c.after_hours_phone}</span> : null}
                      </td>
                      <td>
                        <StatusMark label={c.is_active ? "In use" : "Off"} tone={c.is_active ? "green" : "muted"} />
                      </td>
                      <td className="text-right">
                        <CollectorForm collector={c} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Panel title="Add One">
            <CollectorForm />
          </Panel>
        </>
      )}
    </div>
  );
}
