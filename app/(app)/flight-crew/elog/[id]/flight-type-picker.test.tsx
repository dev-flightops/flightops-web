import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateSummaryAction, refresh } = vi.hoisted(() => ({
  updateSummaryAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./summary-actions", () => ({ updateSummaryAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { FlightTypePicker } from "./flight-type-picker";

describe("FlightTypePicker (#104)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the new type and refreshes the log", async () => {
    updateSummaryAction.mockResolvedValue({ status: "ok" });
    render(<FlightTypePicker logId="log-1" initialType="advisory" />);
    const select = screen.getByLabelText(/Flight Type/);
    expect(select).toHaveValue("advisory");

    await userEvent.selectOptions(select, "scheduled");
    expect(updateSummaryAction).toHaveBeenCalledWith("log-1", { flight_type: "scheduled" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(select).toHaveValue("scheduled");
  });

  it("puts the old type back and says why when the save is refused", async () => {
    updateSummaryAction.mockResolvedValue({
      status: "error",
      message: "This log is submitted and can't be edited.",
    });
    render(<FlightTypePicker logId="log-1" initialType="charter" />);
    await userEvent.selectOptions(screen.getByLabelText(/Flight Type/), "training");
    expect(await screen.findByRole("alert")).toHaveTextContent(/submitted/);
    expect(screen.getByLabelText(/Flight Type/)).toHaveValue("charter");
    expect(refresh).not.toHaveBeenCalled();
  });
});
