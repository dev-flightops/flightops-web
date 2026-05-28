import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./data-table";

const sample = (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Flight</TableHead>
        <TableHead>Route</TableHead>
        <TableHead>Tail</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>GV101</TableCell>
        <TableCell>PADU → PANC</TableCell>
        <TableCell>N207GE</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>GV103</TableCell>
        <TableCell>PANC → PAKN</TableCell>
        <TableCell>N510PA</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

describe("DataTable", () => {
  it("renders headers and rows", () => {
    render(sample);
    expect(screen.getByText("Flight")).toBeInTheDocument();
    expect(screen.getByText("GV101")).toBeInTheDocument();
    expect(screen.getByText("PANC → PAKN")).toBeInTheDocument();
  });

  it("uses a real <table> structure for screen readers", () => {
    render(sample);
    const table = screen.getByRole("table");
    expect(table.tagName).toBe("TABLE");
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getAllByRole("row")).toHaveLength(3); // 1 header + 2 body
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(sample);
    await expectNoA11yViolations(container);
  });
});
