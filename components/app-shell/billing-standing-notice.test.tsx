import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BillingStanding } from "@/lib/api/billing";

import { BillingStandingNotice } from "./billing-standing-notice";

const GRACE: BillingStanding = {
  state: "grace",
  payment_failed_at: "2026-10-27T18:00:00Z",
  read_only_from: "2026-11-10T18:00:00Z",
};
const READ_ONLY: BillingStanding = { ...GRACE, state: "read_only" };

describe("BillingStandingNotice (#127)", () => {
  it("says nothing while the subscription is paid up, or unknown", () => {
    const ok: BillingStanding = { state: "ok", payment_failed_at: null, read_only_from: null };
    const { container: a } = render(<BillingStandingNotice standing={ok} canPay />);
    const { container: b } = render(<BillingStandingNotice standing={null} canPay />);
    expect(a).toBeEmptyDOMElement();
    expect(b).toBeEmptyDOMElement();
  });

  it("in grace, warns when read-only starts, in Alaska time", () => {
    render(<BillingStandingNotice standing={GRACE} canPay={false} />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Payment failed");
    // 18:00Z on 10 Nov is 09:00 AKST.
    expect(notice).toHaveTextContent("If it isn’t paid by Nov 10, 09:00 AKST, nothing can be changed");
    expect(notice).toHaveTextContent("Flight following, safety reports and clocking out will keep working.");
  });

  it("read-only, says so and what still works", () => {
    render(<BillingStandingNotice standing={READ_ONLY} canPay={false} />);
    const notice = screen.getByText(/nothing can be changed until it’s paid/).closest(".notice");
    expect(notice).toHaveTextContent("Read-only");
    expect(notice).toHaveTextContent("Nothing has been deleted.");
    expect(notice).toHaveTextContent("Flight following, safety reports and clocking out keep working.");
  });

  it("gives the way to pay to those who manage the subscription", () => {
    render(<BillingStandingNotice standing={READ_ONLY} canPay />);
    expect(screen.getByRole("link", { name: /Pay in Settings › Billing/ })).toHaveAttribute(
      "href",
      "/settings/billing",
    );
  });

  it("tells everyone else who can pay", () => {
    render(<BillingStandingNotice standing={GRACE} canPay={false} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "An Exec Admin or the Director of Operations can pay it in Settings › Billing.",
    );
  });
});
