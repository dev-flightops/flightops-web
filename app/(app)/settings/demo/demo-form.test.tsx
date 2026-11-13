import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const prepare = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ prepareDemoAction: prepare }));
import { DemoForm } from "./demo-form";

const status = { enabled: true, company_name: "Demo Company", timezone: "America/Anchorage", company_date: "2026-11-01" };

describe("Demo preparation", () => {
  it("requires exact confirmation and stays disabled until the operation completes", async () => {
    let finish!: (result: unknown) => void;
    prepare.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<DemoForm status={status} />);
    const input = screen.getByRole("textbox", { name: "Confirm company name" });
    const button = screen.getByRole("button", { name: "Prepare today’s demo" });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "Demo Company" } });
    fireEvent.click(button);
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preparing today’s demo…" })).toBeDisabled();
    finish({ result: { company_date: "2026-11-01", timezone: "America/Anchorage", summary: { flights: 6, aircraft: 6 } } });
    expect(await screen.findByRole("status")).toHaveTextContent("Demo ready for 2026-11-01");
    expect(screen.getByRole("status")).toHaveTextContent("Use Evan Brooks (prepared.pilot@demo.example) for the pilot workflow; Maya Larsen and Daniel Kowalski fly DEMO102 and DEMO103.");
    expect(screen.getByText(/three reserved demo pilots’ duty/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Fleet Board" })).toHaveAttribute("href", "/reservations/fleet-board");
    expect(input).toHaveValue("");
  });

  it("shows a refused refresh without claiming success", async () => {
    prepare.mockResolvedValueOnce({ error: "A demo preparation is already running." });
    render(<DemoForm status={status} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Demo Company" } });
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("already running"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
