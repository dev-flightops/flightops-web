import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DocumentsPage from "./page";

describe("/documents (empty-state shell)", () => {
  it("renders the legacy header + subtitle + breadcrumb", () => {
    render(<DocumentsPage />);
    expect(
      screen.getByRole("heading", { name: "Document Library" }),
    ).toBeDefined();
    expect(
      screen.getByText(/Company manuals, regulations, safety bulletins/),
    ).toBeDefined();
    expect(screen.getByText(/0 documents/)).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeDefined();
  });

  it("renders the filter bar (search + category + compliance toggle + Filter)", () => {
    render(<DocumentsPage />);
    expect(
      screen.getByPlaceholderText("Title, tags, filename…"),
    ).toBeDefined();
    expect(screen.getByRole("combobox")).toBeDefined();
    expect(
      screen.getByRole("checkbox", { name: /Compliance sources only/ }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Filter" })).toBeDefined();
  });

  it("renders both Upload Document buttons as disabled with a milestone tooltip", () => {
    render(<DocumentsPage />);
    const buttons = screen.getAllByRole("button", { name: /Upload Document/ });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const b of buttons) {
      expect(b.getAttribute("aria-disabled")).toBe("true");
      expect(b.getAttribute("title") ?? "").toMatch(/documents-service/);
    }
  });

  it("uses '+ Upload Document' in the header and 'Upload Document' in the empty state (matches legacy)", () => {
    render(<DocumentsPage />);
    expect(
      screen.getByRole("button", { name: "+ Upload Document" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Upload Document" }),
    ).toBeDefined();
  });

  it("shows the empty-state copy from legacy", () => {
    render(<DocumentsPage />);
    expect(
      screen.getByText(
        "No documents yet. Upload your first document to get started.",
      ),
    ).toBeDefined();
  });
});
