import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { CrewLegalityHints } from "./crew-status-rows";

describe("CrewLegalityHints", () => {
  it("renders the two crew-legality + airworthiness hint lines", () => {
    render(<CrewLegalityHints />);
    expect(
      screen.getByText(/Enter PIC\/SIC names above to check crew legality/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Enter N-number above to check airworthiness/i),
    ).toBeInTheDocument();
  });

  it("drops each hint once what it asks for is set (1119-15)", () => {
    const { rerender, container } = render(<CrewLegalityHints hasPic />);
    expect(screen.queryByText(/Enter PIC\/SIC names above/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Enter N-number above/i)).toBeInTheDocument();

    rerender(<CrewLegalityHints hasAircraft />);
    expect(screen.getByText(/Enter PIC\/SIC names above/i)).toBeInTheDocument();
    expect(screen.queryByText(/Enter N-number above/i)).not.toBeInTheDocument();

    rerender(<CrewLegalityHints hasPic hasAircraft />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(<CrewLegalityHints />);
    await expectNoA11yViolations(container);
  });
});
