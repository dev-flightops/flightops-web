import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  downloadUrl,
  getDocument,
  versionDownloadUrl,
  type DocumentDetailResponse,
  type DocumentVersion,
} from "@/lib/api/documents";

import { UploadVersionDrawer } from "./upload-version-drawer";

/**
 * /documents/[documentId] — Document detail.
 *
 * Header: title + category + description + [Download current] + [+ Upload New Version]
 * Metadata card: created by, updated at, current version pointer
 * Versions table: v#, filename, size, uploaded by, uploaded at, notes,
 *                 download link per row
 */
export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;

  let detail: DocumentDetailResponse;
  try {
    detail = await getDocument(documentId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { document: doc, versions } = detail;
  const currentVersion = versions.find(
    (v) => v.id === doc.current_version_id,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center text-xs">
        <Link
          href="/home"
          aria-label="Home"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <Link
          href="/documents"
          className="text-muted-foreground hover:text-foreground"
        >
          Documents
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="truncate font-semibold text-status-blue">
          {doc.title}
        </span>
      </nav>

      <header className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            Document · {doc.category}
          </div>
          <h1 className="mt-0.5 truncate text-2xl font-bold sm:text-3xl">
            {doc.title}
          </h1>
          {doc.description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {doc.description}
            </p>
          )}
          {doc.is_archived && (
            <span className="mt-2 inline-block rounded border border-status-yellow/40 bg-status-yellow/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-status-yellow">
              Archived
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentVersion && (
            <a
              href={downloadUrl(doc.id)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
            >
              ↓ Download current (v{currentVersion.version_number})
            </a>
          )}
          <UploadVersionDrawer documentId={doc.id} />
        </div>
      </header>

      <MetaStrip doc={doc} versionCount={versions.length} />

      <VersionsCard docId={doc.id} versions={versions} currentId={doc.current_version_id} />
    </div>
  );
}

function MetaStrip({
  doc,
  versionCount,
}: {
  doc: DocumentDetailResponse["document"];
  versionCount: number;
}) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Versions" value={String(versionCount)} />
      <StatCard
        label="Current version"
        value={
          doc.current_version_number > 0 ? `v${doc.current_version_number}` : "—"
        }
      />
      <StatCard label="Created by" value={doc.created_by_name ?? "—"} small />
      <StatCard label="Last updated" value={fmtDateTime(doc.updated_at)} small />
    </div>
  );
}

function StatCard({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div
        className={
          "font-bold text-foreground " +
          (small ? "truncate text-sm" : "text-lg")
        }
        title={value}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function VersionsCard({
  docId,
  versions,
  currentId,
}: {
  docId: string;
  versions: DocumentVersion[];
  currentId: string | null;
}) {
  const sorted = [...versions].sort(
    (a, b) => b.version_number - a.version_number,
  );

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Version History
        </h2>
        <span className="text-xs text-muted-foreground/60">
          {sorted.length} version{sorted.length === 1 ? "" : "s"} · newest first
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No versions uploaded yet. Use{" "}
            <span className="font-semibold">+ Upload New Version</span> above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Version</th>
                  <th className="px-3 py-2.5 font-semibold">File</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Size
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Uploaded by</th>
                  <th className="px-3 py-2.5 font-semibold">Uploaded</th>
                  <th className="px-3 py-2.5 font-semibold">Notes</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((v) => (
                  <tr
                    key={v.id}
                    className={
                      "hover:bg-muted/5 " + (v.id === currentId ? "bg-muted/5" : "")
                    }
                  >
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="font-mono text-xs font-semibold">
                        v{v.version_number}
                      </span>
                      {v.id === currentId && (
                        <span className="ml-2 rounded border border-status-green/40 bg-status-green/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-status-green">
                          Current
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block truncate text-xs">
                        {v.original_filename}
                      </span>
                      <span className="block text-[0.65rem] text-muted-foreground/70">
                        {v.content_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                      {fmtSize(v.size_bytes)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {v.uploaded_by_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {fmtDateTime(v.uploaded_at)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {v.notes ?? <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <a
                        href={versionDownloadUrl(docId, v.version_number)}
                        className="text-xs font-semibold text-status-blue hover:underline"
                      >
                        ↓ Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }) + " UTC";
}
