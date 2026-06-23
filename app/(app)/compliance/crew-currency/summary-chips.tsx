import Link from "next/link";

import type { ComplianceChips } from "@/lib/api/types";

import type { CurrencyStatus } from "./types";

/**
 * The four summary chips at the top of the compliance board.
 * Spec 5 §"Summary chips":
 *   "X Fully Current (green), Y Early Month (teal), Z Grace Month
 *    (yellow), W Non-Current (red). Clicking any chip filters the
 *    grid to that status."
 *
 * Each chip is a Link toggling the URL `?status=…` param. Clicking
 * the active chip again clears the filter (Link to `.`).
 */

interface ChipDef {
  key: "fully_current" | "early_month" | "grace_month" | "non_current";
  label: string;
  filterStatus: CurrencyStatus | null;
  /** Tailwind text + border color when this chip is the active filter. */
  activeClasses: string;
  /** Tailwind classes when not active. */
  idleClasses: string;
}

const CHIPS: ChipDef[] = [
  {
    key: "fully_current",
    label: "Fully Current",
    // The "fully current" bucket maps to neither NOT_STARTED nor any
    // urgent status — it's the residual. We surface a filter for
    // due_this_month because that's the actionable green bucket;
    // pilots with no urgent items still show up on the grid by
    // default (no filter) anyway.
    filterStatus: "due_this_month",
    activeClasses:
      "border-status-green/60 bg-status-green/15 text-status-green",
    idleClasses:
      "border-status-green/30 bg-status-green/5 text-status-green hover:bg-status-green/10",
  },
  {
    key: "early_month",
    label: "Early Month",
    filterStatus: "early_month",
    activeClasses: "border-status-teal/60 bg-status-teal/15 text-status-teal",
    idleClasses:
      "border-status-teal/30 bg-status-teal/5 text-status-teal hover:bg-status-teal/10",
  },
  {
    key: "grace_month",
    label: "Grace Month",
    filterStatus: "grace_month",
    activeClasses:
      "border-status-yellow/60 bg-status-yellow/15 text-status-yellow",
    idleClasses:
      "border-status-yellow/30 bg-status-yellow/5 text-status-yellow hover:bg-status-yellow/10",
  },
  {
    key: "non_current",
    label: "Non-Current",
    filterStatus: "non_current",
    activeClasses: "border-status-red/60 bg-status-red/15 text-status-red",
    idleClasses:
      "border-status-red/30 bg-status-red/5 text-status-red hover:bg-status-red/10",
  },
];

export function SummaryChips({
  chips,
  active,
}: {
  chips: ComplianceChips;
  active: CurrencyStatus | null;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {CHIPS.map((chip) => {
        const isActive = chip.filterStatus === active;
        const href = isActive
          ? "/compliance/crew-currency"
          : `/compliance/crew-currency?status=${chip.filterStatus}`;
        return (
          <Link
            key={chip.key}
            href={href}
            replace
            aria-pressed={isActive}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${
              isActive ? chip.activeClasses : chip.idleClasses
            }`}
          >
            <span className="text-base font-bold">{chips[chip.key]}</span>
            <span>{chip.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
