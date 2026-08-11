import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { Subscription } from "@/lib/api/billing";

import { DunningBanner } from "./dunning-banner";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    plan_code: "growth",
    plan_name: "Growth",
    status: "active",
    seat_count: 5,
    current_period_start: "2026-08-01T00:00:00Z",
    current_period_end: "2026-08-31T00:00:00Z",
    cancel_at_period_end: false,
    canceled_at: null,
    dunning_attempts: 0,
    next_payment_attempt_at: null,
    ...overrides,
  };
}

describe("DunningBanner", () => {
  it("renders nothing for a healthy subscription", () => {
    const { container } = render(<DunningBanner subscription={makeSub()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the retry banner for past_due with a next retry time", () => {
    render(
      <DunningBanner
        subscription={makeSub({
          status: "past_due",
          dunning_attempts: 2,
          next_payment_attempt_at: "2026-08-14T15:00:00Z",
        })}
        managePaymentSlot={<button type="button">Manage payment</button>}
      />,
    );
    expect(
      screen.getByText(/Payment failed — Stripe is retrying/),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 attempts so far/)).toBeInTheDocument();
    // Slot renders — the page passes ManagePaymentButton; the test
    // passes a plain <button> to keep next-auth out of the deps.
    expect(
      screen.getByRole("button", { name: /manage payment/i }),
    ).toBeInTheDocument();
  });

  it("renders singular 'attempt' when dunning_attempts === 1", () => {
    render(
      <DunningBanner
        subscription={makeSub({
          status: "past_due",
          dunning_attempts: 1,
          next_payment_attempt_at: "2026-08-14T15:00:00Z",
        })}
      />,
    );
    expect(screen.getByText(/1 attempt so far/)).toBeInTheDocument();
  });

  it("renders the canceled variant when Stripe exhausted retries", () => {
    render(
      <DunningBanner
        subscription={makeSub({
          status: "canceled",
          dunning_attempts: 4,
          canceled_at: "2026-08-10T00:00:00Z",
        })}
        managePaymentSlot={<button type="button">Manage payment</button>}
      />,
    );
    expect(
      screen.getByText(/Subscription canceled — payment could not be recovered/),
    ).toBeInTheDocument();
    // No manage-payment button — the sub is gone, portal isn't the
    // right path anymore (they need to choose a plan again). The
    // slot is passed in but must be suppressed in this state.
    expect(
      screen.queryByRole("button", { name: /manage payment/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render for status=canceled without any prior dunning", () => {
    // Voluntary cancellation (user clicked Cancel in the portal) —
    // no dunning attempts, so the banner would be misleading.
    const { container } = render(
      <DunningBanner
        subscription={makeSub({
          status: "canceled",
          dunning_attempts: 0,
          canceled_at: "2026-08-10T00:00:00Z",
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has no a11y violations in the retry state", async () => {
    const { container } = render(
      <DunningBanner
        subscription={makeSub({
          status: "past_due",
          dunning_attempts: 2,
          next_payment_attempt_at: "2026-08-14T15:00:00Z",
        })}
        managePaymentSlot={<button type="button">Manage payment</button>}
      />,
    );
    await expectNoA11yViolations(container);
  });
});
