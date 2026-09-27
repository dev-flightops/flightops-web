import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotBuiltPage } from "./not-built-page";

describe("NotBuiltPage", () => {
  it("names the feature, says it is not built, and points at what does exist", () => {
    render(
      <NotBuiltPage
        title="Maintenance Clock"
        summary="Track the time an aircraft spends in maintenance."
        meanwhile={{
          text: "Open maintenance jobs are on",
          href: "/maintenance/work-orders",
          label: "Work Orders",
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Maintenance Clock" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("This isn't built yet.");
    expect(screen.getByRole("link", { name: "Work Orders" })).toHaveAttribute(
      "href",
      "/maintenance/work-orders",
    );
  });

  it("offers no control that looks like it works", () => {
    // The pages it replaced had "Begin Work" and "+ Add Part" buttons
    // styled live and wired to nothing.
    render(<NotBuiltPage title="Parts Inventory" summary="Parts stock by location." />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});
