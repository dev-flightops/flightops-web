import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CurrencyItemRef, PilotCurrencyCell } from "@/lib/api/types";

// The button's dialog reaches a server action, and through it next-auth,
// which does not resolve under vitest.
vi.mock("./log-completion-button", () => ({ LogCompletionButton: () => null }));

import { CurrencyItemCard } from "./currency-item-card";

const MEDICAL: CurrencyItemRef = {
  id: "m-1",
  code: "medical_certificate",
  name: "Medical Certificate",
  regulation: "14 CFR 61.23",
  interval_type: "medical_hard_expiry",
  requires_examiner: false,
  is_check_event: false,
  is_initial_only: false,
  rolling_days: null,
  rolling_threshold: null,
  sort_order: 90,
  is_default: true,
  is_active: true,
};

function cell(over: Partial<PilotCurrencyCell>): PilotCurrencyCell {
  return {
    currency_item_id: "m-1",
    status: "upcoming",
    last_completed_date: null,
    base_month_due: null,
    grace_month_end: null,
    rolling_count: null,
    ...over,
  };
}

function field(label: string): string | null | undefined {
  return screen.getByText(label).nextElementSibling?.textContent;
}

describe("CurrencyItemCard — medical (#87)", () => {
  it("shows the exam and the expiry, not a base month and grace", () => {
    render(
      <CurrencyItemCard
        item={MEDICAL}
        cell={cell({
          last_completed_date: "2026-10-21",
          base_month_due: "2027-10-31",
          grace_month_end: "2027-10-31",
        })}
        pilotId="p-1"
        pilotName="Tomas Eklund"
      />,
    );
    expect(field("Exam")).toBe("2026-10-21");
    expect(field("Expires")).toBe("2027-10-31");
    expect(screen.queryByText("Grace Ends")).not.toBeInTheDocument();
    expect(screen.queryByText("Next Base Month")).not.toBeInTheDocument();
  });

  it("records no exam for a medical logged before classes, whose date was the expiry", () => {
    render(
      <CurrencyItemCard
        item={MEDICAL}
        cell={cell({
          last_completed_date: "2026-10-21",
          base_month_due: "2026-10-21",
          grace_month_end: "2026-10-21",
        })}
        pilotId="p-1"
        pilotName="Tomas Eklund"
      />,
    );
    expect(field("Exam")).toBe("—");
    expect(field("Expires")).toBe("2026-10-21");
  });
});
