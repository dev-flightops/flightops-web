import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// A next/link stand-in that marks what it renders, so a client-side link
// can be told from a plain one. jsdom has no app router, so a click on
// the real Link behaves like a plain anchor's there.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a data-next-link="" href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ACCOUNTING_EXPORT_PATH, AcctExportFilterBar } from "./filter-bar";

describe("AcctExportFilterBar", () => {
  it("R4: Reset is a plain link to the bare URL, so it reloads the page as legacy's does", () => {
    render(<AcctExportFilterBar start="2026-09-01" end="2026-09-30" />);

    const reset = screen.getByRole("link", { name: "Reset" });
    expect(reset.getAttribute("href")).toBe(ACCOUNTING_EXPORT_PATH);
    // A next/link to the URL already showing navigates client-side, and
    // on the default range that keeps dates typed but not applied.
    expect(reset).not.toHaveAttribute("data-next-link");
  });

  it("shows the range it is given in From and To", () => {
    render(<AcctExportFilterBar start="2026-09-01" end="2026-09-30" />);

    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe(
      "2026-09-01",
    );
    expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe(
      "2026-09-30",
    );
  });

  it("#27: offers All customers and each customer, with the chosen one selected", () => {
    render(
      <AcctExportFilterBar
        start="2026-09-01"
        end="2026-09-30"
        customer="c-2"
        customers={[
          { id: "c-1", name: "Acme Mining" },
          { id: "c-2", name: "Bo Flyer" },
        ]}
      />,
    );
    const select = screen.getByLabelText("Customer") as HTMLSelectElement;
    expect(select.name).toBe("customer");
    expect([...select.options].map((o) => [o.value, o.text])).toEqual([
      ["", "All customers"],
      ["c-1", "Acme Mining"],
      ["c-2", "Bo Flyer"],
    ]);
    expect(select.value).toBe("c-2");
  });

  it("#27: leaves the customer filter out when there are no customers to list", () => {
    render(<AcctExportFilterBar start="2026-09-01" end="2026-09-30" />);
    expect(screen.queryByLabelText("Customer")).toBeNull();
  });
});
