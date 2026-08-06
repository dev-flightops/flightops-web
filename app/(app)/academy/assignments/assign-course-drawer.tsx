"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Course } from "@/lib/api/academy";
import type { UserResponse } from "@/lib/api/types";

import { bulkAssignAction, type BulkAssignResult } from "./actions";

interface Props {
  courses: Course[];
  users: UserResponse[];
}

/**
 * Slide-over that picks a course + a set of learners and hands the
 * pair to the bulk-assign server action. Serial `enrol()` fan-out
 * on the server so the admin doesn't need to know the endpoint is
 * one-at-a-time. Post-run summary surfaces assigned / skipped /
 * per-learner failures inline before the drawer closes.
 */
export function AssignCourseDrawer({ courses, users }: Props) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [result, setResult] = useState<BulkAssignResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      for (const r of u.roles) set.add(r);
    }
    return Array.from(set).sort();
  }, [users]);

  const visibleUsers = useMemo(() => {
    const needle = nameFilter.trim().toLowerCase();
    return users.filter((u) => {
      if (!u.is_active) return false;
      if (roleFilter && !u.roles.includes(roleFilter)) return false;
      if (needle) {
        const hay = `${u.full_name} ${u.email}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [users, roleFilter, nameFilter]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const u of visibleUsers) next.add(u.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const reset = () => {
    setCourseId("");
    setSelectedIds(new Set());
    setRoleFilter("");
    setNameFilter("");
    setResult(null);
  };

  const handleClose = () => {
    setOpen(false);
    reset();
    if (result?.assigned) router.refresh();
  };

  const handleSubmit = () => {
    const labels: Record<string, string> = {};
    for (const u of users) {
      labels[u.id] = u.full_name || u.email;
    }
    setResult(null);
    startTransition(async () => {
      const r = await bulkAssignAction(
        courseId,
        Array.from(selectedIds),
        labels,
      );
      setResult(r);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
      >
        + Assign Course
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Assign a course"
          className="fixed inset-0 z-40 flex items-start justify-end bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-xl">
            <header className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div>
                <h2 className="text-base font-bold">Assign a Course</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pick a course + one or more learners. Anyone already in
                  progress on the course is skipped automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="rounded p-1 text-muted-foreground hover:bg-muted/20"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Course
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none"
                disabled={pending}
              >
                <option value="">— Select a course —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Learners
                  </label>
                  <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                    <span>{selectedIds.size} selected</span>
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      className="text-status-blue hover:underline"
                      disabled={pending || visibleUsers.length === 0}
                    >
                      Select visible
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-muted-foreground hover:underline"
                      disabled={pending || selectedIds.size === 0}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-2 gap-2">
                  <input
                    type="search"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder="Search by name or email"
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
                    disabled={pending}
                  />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
                    disabled={pending}
                  >
                    <option value="">All roles</option>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-background">
                  {visibleUsers.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No active users match the filter.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {visibleUsers.map((u) => {
                        const checked = selectedIds.has(u.id);
                        return (
                          <li key={u.id}>
                            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-xs hover:bg-muted/10">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleUser(u.id)}
                                disabled={pending}
                                className="h-3.5 w-3.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-foreground">
                                  {u.full_name || u.email}
                                </div>
                                <div className="truncate text-[0.65rem] text-muted-foreground">
                                  {u.email}
                                  {u.roles.length > 0 && (
                                    <>
                                      {" · "}
                                      {u.roles
                                        .map((r) => r.replace(/_/g, " "))
                                        .join(", ")}
                                    </>
                                  )}
                                </div>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {result && (
                <div
                  role="status"
                  className={
                    "mt-4 rounded-md border px-3 py-2 text-xs " +
                    (result.ok
                      ? "border-status-green/40 bg-status-green/10 text-status-green"
                      : "border-status-yellow/40 bg-status-yellow/10 text-status-yellow")
                  }
                >
                  {result.error ? (
                    <p className="text-status-red">{result.error}</p>
                  ) : (
                    <p>
                      Assigned <span className="font-semibold">{result.assigned}</span>{" "}
                      · Skipped <span className="font-semibold">{result.skipped}</span>
                      {result.failures.length > 0 && (
                        <>
                          {" · "}
                          <span className="font-semibold">
                            {result.failures.length}
                          </span>{" "}
                          failed
                        </>
                      )}
                    </p>
                  )}
                  {result.failures.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[0.7rem] text-status-red">
                      {result.failures.slice(0, 6).map((f) => (
                        <li key={f.user_id}>
                          {f.label} — {f.error}
                        </li>
                      ))}
                      {result.failures.length > 6 && (
                        <li>… and {result.failures.length - 6} more</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
              >
                {result?.assigned ? "Close" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  pending ||
                  !courseId ||
                  selectedIds.size === 0 ||
                  Boolean(result?.assigned)
                }
                className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending
                  ? `Assigning ${selectedIds.size}…`
                  : `Assign to ${selectedIds.size}`}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
