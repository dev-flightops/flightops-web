import Link from "next/link";
import { isoDayToUtcDate } from "@/lib/iso-day";
import { notFound } from "next/navigation";

import { getCompanyProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  getRewardsMember,
  REWARDS_TIER_LABELS,
  REWARDS_TRANSACTION_TYPE_LABELS,
  type RewardsMemberDetailResponse,
  type RewardsTier,
} from "@/lib/api/rewards";

import { TransactionForm } from "./transaction-form";

/** /reservations/rewards/[memberId] — rewards member detail.
 *
 *   Header  = member number + customer + tier badge + balance/lifetime pillsels
 *   Body    = manual transaction form + reverse-chron ledger table
 */

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  // Parsed as UTC to match the UTC formatter below. Without that the
  // string parses in the host's zone and a date east of Greenwich
  // renders as the day before — see lib/iso-day.ts.
  const d = isoDayToUtcDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPoints(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US")}`;
}

export default async function RewardsMemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;

  let programName = "Rewards Program";
  let detail: RewardsMemberDetailResponse | null = null;
  try {
    const [profile, d] = await Promise.all([
      getCompanyProfile(),
      getRewardsMember(memberId),
    ]);
    if (profile.rewards_program_name) {
      programName = profile.rewards_program_name;
    }
    detail = d;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) throw err;
      if (err.status === 404) notFound();
    }
    throw err;
  }

  if (!detail) notFound();

  const { member, transactions } = detail;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link
          href="/reservations/rewards"
          className="hover:text-foreground"
        >
          {programName}
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="text-foreground">
          {member.member_number}
        </span>
      </nav>

      <header className="mb-6 border-b border-border pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">
              {member.customer_name ?? "—"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {member.member_number} · enrolled{" "}
              {formatDate(member.enrollment_date)}
              {member.enrolled_station ? ` at ${member.enrolled_station}` : ""}
            </p>
          </div>
          <TierBadge tier={member.tier} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="eyebrow">
              Balance
            </dt>
            <dd className="mt-1 font-display text-[1.75rem] font-extrabold leading-none tabular-nums text-foreground">
              {member.points_balance.toLocaleString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">
              Lifetime
            </dt>
            <dd className="mt-1 font-display text-[1.75rem] font-extrabold leading-none tabular-nums">
              {member.lifetime_points.toLocaleString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">
              Active
            </dt>
            <dd
              className={
                "mt-0.5 text-sm font-semibold " +
                (member.is_active ? "text-status-green" : "text-muted-foreground")
              }
            >
              {member.is_active ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">
              Ledger entries
            </dt>
            <dd className="mt-0.5 text-sm font-semibold">
              {transactions.length}
            </dd>
          </div>
        </dl>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 eyebrow">
          Record transaction
        </h2>
        <TransactionForm memberId={member.id} />
      </section>

      <section>
        <h2 className="mb-3 eyebrow">
          Ledger
        </h2>
        {transactions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="ff-thead">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">When</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Type</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Points</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-accent">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {formatTimestamp(t.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {REWARDS_TRANSACTION_TYPE_LABELS[t.transaction_type]}
                      </td>
                      <td
                        className={
                          "whitespace-nowrap px-4 py-3 text-right font-mono text-xs font-semibold " +
                          (t.points > 0
                            ? "text-status-green"
                            : "text-status-red")
                        }
                      >
                        {formatPoints(t.points)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {t.description ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function TierBadge({ tier }: { tier: RewardsTier }) {
  const cls =
    tier === "elite"
      ? "text-status-red"
      : tier === "gold"
        ? "text-status-yellow"
        : tier === "silver"
          ? "text-status-blue"
          : "text-muted-foreground";
  return (
    <span
      className={
        "status-mark text-[0.75rem] " +
        cls
      }
    >
      {REWARDS_TIER_LABELS[tier]}
    </span>
  );
}
