import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RemoveRowButton } from "./remove-row-button";

const confirm = vi.spyOn(window, "confirm");

beforeEach(() => vi.clearAllMocks());
afterEach(() => confirm.mockReset());

describe("RemoveRowButton (#134)", () => {
  it("does nothing until it's confirmed", async () => {
    confirm.mockReturnValue(false);
    const action = vi.fn();
    render(<RemoveRowButton label="Remove the fee" confirm="Remove the fee?" action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove the fee" }));
    expect(confirm).toHaveBeenCalledWith("Remove the fee?");
    expect(action).not.toHaveBeenCalled();
  });

  it("removes and refreshes the page", async () => {
    confirm.mockReturnValue(true);
    const action = vi.fn().mockResolvedValue({ ok: true });
    render(<RemoveRowButton label="Remove the fee" confirm="Remove the fee?" action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove the fee" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(action).toHaveBeenCalledOnce();
  });

  it("says why when it can't", async () => {
    confirm.mockReturnValue(true);
    const action = vi.fn().mockResolvedValue({ ok: false, error: "Only an Exec Admin can change this." });
    render(<RemoveRowButton label="Remove the fee" confirm="Remove the fee?" action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove the fee" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only an Exec Admin can change this.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
