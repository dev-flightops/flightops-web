import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { CrewCurrencyBanner, CrewLegalityHints } from "./crew-status-rows";

describe("CrewLegalityHints", () => {
  it("renders the two crew-legality + currency hint lines", () => {
    render(<CrewLegalityHints />);
    expect(
      screen.getByText(/Enter PIC\/SIC names above to check crew legality/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Select a pilot to run a live currency check/i),
    ).toBeInTheDocument();
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(<CrewLegalityHints />);
    await expectNoA11yViolations(container);
  });
});

describe("CrewCurrencyBanner", () => {
  it("renders the green CLEAR banner with the legacy banner copy", () => {
    render(<CrewCurrencyBanner />);
    expect(
      screen.getByText(/Clear — all currency items current/i),
    ).toBeInTheDocument();
  });

  it("shows the PIC name + compliance score + View profile link", () => {
    render(<CrewCurrencyBanner />);
    expect(screen.getByText("Brian Larson")).toBeInTheDocument();
    expect(screen.getByText(/100% compliant/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /View profile/i }),
    ).toBeDisabled();
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(<CrewCurrencyBanner />);
    await expectNoA11yViolations(container);
  });
});
