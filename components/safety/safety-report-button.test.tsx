import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/dispatch/board" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { SafetyReportButton } from "./safety-report-button";

describe("the red Safety button", () => {
  it("opens the safety report form, remembering the page it was pressed on", () => {
    pathname.current = "/dispatch/board";
    render(<SafetyReportButton />);
    expect(screen.getByRole("link", { name: "File a safety report" })).toHaveAttribute(
      "href",
      "/safety/reports/new?return_url=%2Fdispatch%2Fboard",
    );
  });

  it("is not shown on the form itself", () => {
    pathname.current = "/safety/reports/new";
    const { container } = render(<SafetyReportButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
