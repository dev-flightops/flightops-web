import Link from "next/link";

import type { ComplianceChips } from "@/lib/api/types";

import type { CurrencyStatus } from "./types";
import type { ComplianceView } from "./view-switcher";

/**
 * The four summary chips at the top of the compliance board.
 * Spec 5 §"Summary chips", in the GOM's colours (#66): X Fully Current,
 * Y Early Month, Z Grace Month (red, alert), W Non-Current (magenta,
 * critical). Clicking any chip filters the grid to that status.
 *
 * Each chip is a Link toggling the URL `?status=…` param. Clicking
 * the active chip again clears the filter (Link to `.`).
 */

interface ChipDef {
  key: "fully_current" | "early_month" | "grace_month" | "non_current";
  label: string;
  filterStatus: CurrencyStatus | null;
  /** The figure's rule colour, as the Flight Following stats draw it. */
  rule: string;
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
    rule: "border-status-green",
  },
  {
    key: "early_month",
    label: "Early Month",
    filterStatus: "early_month",
    rule: "border-status-green",
  },
  {
    key: "grace_month",
    label: "Grace Month",
    filterStatus: "grace_month",
    rule: "border-status-red",
  },
  {
    key: "non_current",
    label: "Non-Current",
    filterStatus: "non_current",
    rule: "border-status-magenta",
  },
];

export function SummaryChips({
  chips,
  active,
  view = "grid",
}: {
  chips: ComplianceChips;
  active: CurrencyStatus | null;
  /** Preserves the M2-G-3 view selection when toggling status. */
  view?: ComplianceView;
}) {
  return (
    // The counts as figures (#80), each a filter: the number in the display
    // face, a capitals label, the status colour as a rule to its left; the
    // active one sits on a ground.
    <div className="mb-5 flex flex-wrap gap-x-2 gap-y-3">
      {CHIPS.map((chip) => {
        const isActive = chip.filterStatus === active;
        const params = new URLSearchParams();
        if (!isActive && chip.filterStatus) {
          params.set("status", chip.filterStatus);
        }
        if (view !== "grid") params.set("view", view);
        const href =
          "/compliance/crew-currency" +
          (params.toString() ? `?${params.toString()}` : "");
        return (
          <Link
            key={chip.key}
            href={href}
            replace
            aria-pressed={isActive}
            className={`flex min-w-[8.5rem] flex-col border-l-2 py-1 pl-3 pr-4 transition-colors hover:bg-accent ${chip.rule} ${
              isActive ? "bg-accent" : ""
            }`}
          >
            <span className="font-display text-[1.6rem] font-extrabold leading-none tabular-nums text-foreground">
              {chips[chip.key]}
            </span>
            <span className="eyebrow mt-1.5">{chip.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
