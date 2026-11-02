import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bump = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ bumpBagsAction: bump }));
import { BumpBags } from "./bump-bags";

function openForm() {
  render(<BumpBags flightId="flight" paxId="passenger" name="Demo Traveller" baggageLbs="20" />);
  fireEvent.click(screen.getByRole("button", { name: "Bump bags" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Weight to bump (lb)" }), { target: { value: "10" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), { target: { value: "Payload limit" } });
}

describe("Bumped baggage recovery", () => {
  beforeEach(() => { bump.mockReset(); });

  it("prevents repeat submission while moving bags, then links to the waiting queue", async () => {
    let finish!: (value: unknown) => void;
    bump.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Move bags to waiting list" }));
    expect(screen.getByRole("button", { name: "Moving bags…" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Reason" })).toBeDisabled();
    expect(bump).toHaveBeenCalledTimes(1);
    expect(bump).toHaveBeenCalledWith("flight", "passenger", { weight_lbs: "10", pieces: 1, reason: "Payload limit" });
    finish({ ok: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Bags moved to the waiting-load queue");
    expect(screen.getByRole("link", { name: "Find the waiting bags" })).toHaveAttribute("href", "/manifest/waiting");
  });

  it("retains the form on refusal without claiming the bags moved", async () => {
    bump.mockResolvedValue({ ok: false, error: "Reopen the manifest first." });
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Move bags to waiting list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reopen the manifest first.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("asks the user to check the result after an interrupted connection", async () => {
    bump.mockRejectedValue(new Error("offline"));
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Move bags to waiting list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the manifest and waiting list before retrying");
    expect(screen.getByRole("button", { name: "Move bags to waiting list" })).toBeEnabled();
  });
});
