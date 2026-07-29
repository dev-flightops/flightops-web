import Link from "next/link";

import { getCompanyProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  listQuyanaMembers,
  QUYANA_TIER_LABELS,
  type QuyanaMemberRow,
  type QuyanaTier,
} from "@/lib/api/quyana";
import { listCustomers, type Customer } from "@/lib/api/reservations";

import { EnrollMemberToggle } from "./enroll-toggle";

/**
 * /reservations/quyana — Rewards Program members list.
 *
 * Program name is per-tenant (company_profile.rewards_program_name).
 * Grant sets theirs to "Quyana Rewards"; a fresh tenant sees
 * "Rewards Program". Empty-state copy and the enroll-button label
 * both read the same value.
 *
 * Backed by flightops-services PR #119 (/reservations/quyana).
 */

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPoints(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function RewardsMembersPage() {
  let programName = "Rewards Program";
  let members: QuyanaMemberRow[] = [];
  let customers: Customer[] = [];
  let loadError: string | null = null;

  try {
    const [profile, memberList, custList] = await Promise.all([
      getCompanyProfile(),
      listQuyanaMembers(),
      listCustomers({ limit: 200 }),
    ]);
    if (profile.rewards_program_name) {
      programName = profile.rewards_program_name;
    }
    members = memberList.items;
    customers = custList.items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw err;
    loadError = "Rewards data unavailable. Try refreshing in a moment.";
  }

  const activeCount = members.filter((m) => m.is_active).length;
  const buttonLabel = `+ Enroll Member`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{programName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeCount} active member{activeCount === 1 ? "" : "s"}
          </p>
        </div>
        {loadError ? null : (
          <EnrollMemberToggle
            customers={customers}
            buttonLabel={buttonLabel}
          />
        )}
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No {programName.toLowerCase()} members yet. Click{" "}
          {buttonLabel} to enroll a customer.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Member #</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Tier</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Balance</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Lifetime</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Enrolled</th>
                  <th scope="col" className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/5">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-status-blue">
                      {m.member_number}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {m.customer_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <TierBadge tier={m.tier} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-status-green">
                      {formatPoints(m.points_balance)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {formatPoints(m.lifetime_points)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(m.enrollment_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/reservations/quyana/${m.id}`}
                        className="text-xs font-semibold text-status-blue hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: QuyanaTier }) {
  const cls =
    tier === "elite"
      ? "border-status-red/40 bg-status-red/10 text-status-red"
      : tier === "gold"
        ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
        : tier === "silver"
          ? "border-status-blue/40 bg-status-blue/10 text-status-blue"
          : "border-border bg-muted/20 text-muted-foreground";
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {QUYANA_TIER_LABELS[tier]}
    </span>
  );
}
