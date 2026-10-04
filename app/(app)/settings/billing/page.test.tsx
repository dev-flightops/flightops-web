import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BillingOverviewResponse,
  Invoice,
  Plan,
  Subscription,
} from "@/lib/api/billing";

const { TestApiError, getBillingOverview } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return { TestApiError, getBillingOverview: vi.fn() };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/billing")>()),
  getBillingOverview,
}));
// The two buttons are client components built on useActionState, which
// the test renderer's React does not have; stub them so the server
// render works in jsdom. They keep their labels, so the tests can count
// which the page offers.
vi.mock("./checkout-button", () => ({
  ChooseCheckoutButton: ({ planCode }: { planCode: string }) => (
    <button type="button" data-plan={planCode}>
      Choose plan →
    </button>
  ),
}));
vi.mock("./portal-button", () => ({
  ManagePaymentButton: () => <button type="button">Manage billing →</button>,
}));

import SettingsBillingPage from "./page";

function plan(code: "starter" | "growth" | "scale", over: Partial<Plan> = {}): Plan {
  const seats = { starter: 8, growth: 25, scale: null }[code];
  return {
    id: `plan-${code}`,
    code,
    name: code[0].toUpperCase() + code.slice(1),
    description: seats === null ? "No seat limit." : `Up to ${seats} seats.`,
    monthly_price_cents: { starter: 9_900, growth: 29_900, scale: 79_900 }[code],
    currency: "USD",
    seat_limit: seats,
    checkout_available: false,
    ...over,
  };
}

const PLANS_NOT_SET_UP = [plan("starter"), plan("growth"), plan("scale")];
const PLANS_FOR_SALE = PLANS_NOT_SET_UP.map((p) => ({ ...p, checkout_available: true }));

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    plan_code: "growth",
    plan_name: "Growth",
    status: "active",
    seat_count: 10,
    current_period_start: "2026-09-01T00:00:00Z",
    current_period_end: "2026-10-01T00:00:00Z",
    cancel_at_period_end: false,
    canceled_at: null,
    dunning_attempts: 0,
    next_payment_attempt_at: null,
    amount_due_cents: 0,
    amount_due_currency: null,
    ...over,
  };
}

function invoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    number: "PFO-0002",
    status: "paid",
    amount_due_cents: 299_000,
    amount_paid_cents: 299_000,
    amount_remaining_cents: 0,
    amount_paid_major: "2990.00",
    currency: "USD",
    period_start: "2026-09-01T00:00:00Z",
    period_end: "2026-10-01T00:00:00Z",
    paid_at: "2026-09-01T00:05:00Z",
    hosted_invoice_url: null,
    invoice_pdf_url: null,
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

/** A deployment without Stripe unless `billing_ready` says otherwise. */
function overview(over: Partial<BillingOverviewResponse> = {}): BillingOverviewResponse {
  return {
    subscription: null,
    invoices: [],
    plans: PLANS_NOT_SET_UP,
    billing_ready: false,
    ...over,
  };
}

async function renderPage() {
  return render(await SettingsBillingPage({ searchParams: Promise.resolve({}) }));
}

const chooseButtons = () => screen.queryAllByRole("button", { name: /choose plan/i });
const manageButtons = () => screen.queryAllByRole("button", { name: /manage billing/i });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Settings → Billing", () => {
  it("says in plain words that billing isn't set up, with no 'price id'", async () => {
    getBillingOverview.mockResolvedValue(overview());
    await renderPage();

    expect(
      screen.getByText(/Billing isn.t set up on this system yet, so plans can.t be bought or changed here/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/price id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Billing is restricted/)).not.toBeInTheDocument();
    expect(chooseButtons()).toHaveLength(0);
  });

  it("says billing isn't set up even beside a subscription, and offers no button that would fail", async () => {
    // The demo: a seeded live subscription, no Stripe keys.
    getBillingOverview.mockResolvedValue(
      overview({
        subscription: sub({ status: "past_due", dunning_attempts: 1, amount_due_cents: 29_900 }),
      }),
    );
    await renderPage();

    expect(screen.getByText("Past due")).toBeInTheDocument();
    expect(
      screen.getByText(/Billing isn.t set up on this system yet, so plans can.t be bought or changed here/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/use Manage billing above/)).not.toBeInTheDocument();
    expect(manageButtons()).toHaveLength(0);
    expect(chooseButtons()).toHaveLength(0);
    // The banner states the failure and what is due, and names no action.
    expect(screen.getByText(/couldn't charge the card on file for \$299\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/under Manage billing/)).not.toBeInTheDocument();
  });

  it("states each plan's seat limit and nothing else", async () => {
    getBillingOverview.mockResolvedValue(overview());
    await renderPage();

    expect(screen.getByText("Up to 8 seats.")).toBeInTheDocument();
    expect(screen.getByText("Up to 25 seats.")).toBeInTheDocument();
    expect(screen.getByText("No seat limit.")).toBeInTheDocument();
  });

  it("shows a cancelled subscription and how to subscribe again", async () => {
    getBillingOverview.mockResolvedValue(
      overview({
        subscription: sub({ status: "canceled", canceled_at: "2026-09-20T12:00:00Z" }),
        plans: PLANS_FOR_SALE,
        billing_ready: true,
      }),
    );
    await renderPage();

    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText(/To subscribe again, choose a plan below/)).toBeInTheDocument();
    expect(screen.queryByText(/No active subscription/)).not.toBeInTheDocument();
    expect(chooseButtons()).toHaveLength(3);
    expect(manageButtons()).toHaveLength(0);
  });

  it("shows unpaid with the amount due, and offers Manage billing, not a second checkout", async () => {
    getBillingOverview.mockResolvedValue(
      overview({
        subscription: sub({
          status: "unpaid",
          dunning_attempts: 4,
          amount_due_cents: 299_000,
          amount_due_currency: "USD",
        }),
        plans: PLANS_FOR_SALE,
        billing_ready: true,
      }),
    );
    await renderPage();

    expect(screen.getByText("Unpaid")).toBeInTheDocument();
    expect(screen.getByText("Amount due")).toBeInTheDocument();
    expect(screen.getAllByText(/\$2,990\.00/).length).toBeGreaterThan(0);
    expect(chooseButtons()).toHaveLength(0);
    expect(manageButtons().length).toBeGreaterThan(0);
  });

  it("offers Manage billing instead of Choose plan while subscribed", async () => {
    getBillingOverview.mockResolvedValue(
      overview({ subscription: sub(), plans: PLANS_FOR_SALE, billing_ready: true }),
    );
    await renderPage();

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(chooseButtons()).toHaveLength(0);
    expect(manageButtons()).toHaveLength(1);
    expect(
      screen.getByText(/To change the plan or the number of seats, use Manage billing above/),
    ).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("shows a failed invoice's amount due, not $0.00 paid", async () => {
    getBillingOverview.mockResolvedValue(
      overview({
        subscription: sub({ status: "past_due", amount_due_cents: 299_000, amount_due_currency: "USD" }),
        invoices: [
          invoice({
            status: "open",
            amount_paid_cents: 0,
            amount_remaining_cents: 299_000,
            amount_paid_major: "0.00",
            paid_at: null,
          }),
        ],
      }),
    );
    await renderPage();

    const row = screen.getByText("PFO-0002").closest("tr");
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("$2,990.00 USD");
    expect(row).not.toHaveTextContent("$0.00");
  });

  it("links an open invoice to Stripe's page to pay it", async () => {
    getBillingOverview.mockResolvedValue(
      overview({
        subscription: sub({ status: "past_due", amount_due_cents: 299_000, amount_due_currency: "USD" }),
        invoices: [
          invoice({
            id: "inv-open",
            number: "PFO-0003",
            status: "open",
            amount_paid_cents: 0,
            amount_remaining_cents: 299_000,
            amount_paid_major: "0.00",
            paid_at: null,
            hosted_invoice_url: "https://invoice.stripe.com/i/acct_1QTest/test_open",
            invoice_pdf_url: "https://pay.stripe.com/invoice/acct_1QTest/test_open/pdf",
          }),
          invoice({
            id: "inv-paid",
            number: "PFO-0002",
            invoice_pdf_url: "https://pay.stripe.com/invoice/acct_1QTest/test_paid/pdf",
          }),
        ],
      }),
    );
    await renderPage();

    const open = screen.getByText("PFO-0003").closest("tr")!;
    expect(open.querySelector("a")?.textContent).toBe("Pay →");
    expect(open.querySelector("a")?.getAttribute("href")).toBe(
      "https://invoice.stripe.com/i/acct_1QTest/test_open",
    );
    const paid = screen.getByText("PFO-0002").closest("tr")!;
    expect(paid.querySelector("a")?.textContent).toBe("↓ PDF");
  });

  it("tells a cancelled subscription that still owes how to pay", async () => {
    getBillingOverview.mockResolvedValue(
      overview({
        subscription: sub({
          status: "canceled",
          canceled_at: "2026-09-20T12:00:00Z",
          amount_due_cents: 299_000,
          amount_due_currency: "USD",
        }),
        invoices: [
          invoice({
            status: "open",
            amount_paid_cents: 0,
            amount_remaining_cents: 299_000,
            amount_paid_major: "0.00",
            paid_at: null,
            hosted_invoice_url: "https://invoice.stripe.com/i/acct_1QTest/test_open",
          }),
        ],
        plans: PLANS_FOR_SALE,
        billing_ready: true,
      }),
    );
    await renderPage();

    expect(
      screen.getByText(/\$2,990\.00 is still due: use Pay on the open invoice below\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay →" })).toBeInTheDocument();
  });

  it("without billing set up, an ended subscription says to ask the contact, not to choose a plan", async () => {
    getBillingOverview.mockResolvedValue(
      overview({
        subscription: sub({ status: "canceled", canceled_at: "2026-09-20T12:00:00Z" }),
      }),
    );
    await renderPage();

    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(
      screen.getByText(/To subscribe again, ask your Peregrine contact: billing isn't set up on this system yet\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/choose a plan below/)).not.toBeInTheDocument();
    expect(chooseButtons()).toHaveLength(0);
  });

  it("names who can see billing when the API refuses", async () => {
    getBillingOverview.mockRejectedValue(
      new TestApiError(403, "/billing/overview", '{"detail":"insufficient_role"}'),
    );
    await renderPage();

    expect(
      screen.getByText(/Only an Executive Admin or a Director of Operations can see billing/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/exec-admin/i)).not.toBeInTheDocument();
  });
});
