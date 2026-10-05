import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

vi.mock("./actions", () => ({ updateCompanyAction: vi.fn() }));
// Next runs the form on React 19; the test runner has React 18, which
// has no useActionState. These tests read the first render only.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import type { CompanyProfileResponse } from "@/lib/api/types";

import { CompanyForm } from "./company-form";

/**
 * The Invoicing section of Settings → Company shows what is stored, the
 * tax as the percentage it was typed as, and says what a blank does.
 */

function profile(
  over: Partial<CompanyProfileResponse> = {},
): CompanyProfileResponse {
  return {
    id: "p-1",
    legal_name: null,
    short_name: null,
    logo_url: null,
    street_line_1: null,
    street_line_2: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    main_phone: null,
    ops_phone: null,
    main_email: null,
    ops_email: null,
    part_135_certificate: null,
    carrier_code: null,
    fiscal_year_end: null,
    cargo_rate_per_lb: null,
    invoice_tax_rate: null,
    invoice_terms_days: null,
    rewards_program_name: "Rewards Program",
    brand_primary_color: null,
    brand_primary_dark_color: null,
    notes: null,
    ...over,
  };
}

describe("Invoicing", () => {
  it("shows the stored rate, the tax as a percentage, and the terms", async () => {
    render(
      <CompanyForm
        profile={profile({
          cargo_rate_per_lb: "0.4750",
          invoice_tax_rate: "0.07500",
          invoice_terms_days: 14,
        })}
      />,
    );
    expect(screen.getByLabelText("Cargo Rate (per lb)")).toHaveValue("0.4750");
    expect(screen.getByLabelText("Invoice Tax Rate (%)")).toHaveValue("7.5");
    expect(screen.getByLabelText("Payment Terms (days)")).toHaveValue("14");
    // The section this story adds. (The Notes textarea below it has no
    // label on main; reported separately rather than fixed here.)
    await expectNoA11yViolations(screen.getByRole("group", { name: "Invoicing" }));
  });

  it("is blank when unset, and says what blank does", () => {
    render(<CompanyForm profile={profile()} />);
    const rate = screen.getByLabelText("Cargo Rate (per lb)");
    expect(rate).toHaveValue("");
    expect(rate).toHaveAccessibleDescription(
      "Dollars per pound, up to four decimals. Prices each cargo line; left blank, cargo is raised with no price and the invoice can't be marked as sent.",
    );
    expect(screen.getByLabelText("Invoice Tax Rate (%)")).toHaveAccessibleDescription(
      "Percent of each invoice's subtotal, 0 to 100. Blank adds no tax.",
    );
    expect(screen.getByLabelText("Payment Terms (days)")).toHaveAccessibleDescription(
      "Days from the invoice date to the due date, 0 to 365. Blank means 30.",
    );
  });
});

describe("a refused save (R2)", () => {
  it("keeps what was typed through React's form reset", async () => {
    // React 19 resets the form's DOM when the action completes, refused
    // or not. Uncontrolled, every field went back to what was stored:
    // Terms 45, typed beside a tax of 101, was lost.
    const user = userEvent.setup();
    const { container } = render(
      <CompanyForm
        profile={profile({
          cargo_rate_per_lb: "0.4750",
          invoice_tax_rate: "0.08250",
          invoice_terms_days: 14,
        })}
      />,
    );
    const terms = screen.getByLabelText("Payment Terms (days)");
    const tax = screen.getByLabelText("Invoice Tax Rate (%)");
    const name = screen.getByLabelText("Legal Name");
    await user.clear(terms);
    await user.type(terms, "45");
    await user.clear(tax);
    await user.type(tax, "101");
    await user.type(name, "Example Air LLC");

    (container.querySelector("form") as HTMLFormElement).reset();

    expect(terms).toHaveValue("45");
    expect(tax).toHaveValue("101");
    expect(name).toHaveValue("Example Air LLC");
    expect(screen.getByLabelText("Cargo Rate (per lb)")).toHaveValue("0.4750");
  });

  it("shows what the service stored once a save lands", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CompanyForm profile={profile()} />);
    await user.type(screen.getByLabelText("Cargo Rate (per lb)"), "0.475");

    // revalidatePath hands back the stored profile: four decimals.
    rerender(
      <CompanyForm
        profile={profile({ cargo_rate_per_lb: "0.4750", invoice_terms_days: 30 })}
      />,
    );
    expect(screen.getByLabelText("Cargo Rate (per lb)")).toHaveValue("0.4750");
    expect(screen.getByLabelText("Payment Terms (days)")).toHaveValue("30");
  });
});

describe("Notes (#41)", () => {
  it("has a label a screen reader announces", async () => {
    const { container } = render(<CompanyForm profile={profile()} />);
    expect(screen.getByLabelText("Notes").tagName).toBe("TEXTAREA");
    await expectNoA11yViolations(container);
  });
});
