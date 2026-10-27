import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setPilotWeightAction } = vi.hoisted(() => ({ setPilotWeightAction: vi.fn() }));
vi.mock("./weight-actions", () => ({ setPilotWeightAction }));

import { PilotWeightCard } from "./pilot-weight-card";

describe("PilotWeightCard (#125)", () => {
  beforeEach(() => {
    setPilotWeightAction.mockReset();
  });

  it("saves the weight typed", async () => {
    setPilotWeightAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PilotWeightCard pilotId="p-1" weightLbs={null} />);
    await user.type(screen.getByLabelText("Weight (lb)"), "176");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(setPilotWeightAction).toHaveBeenCalledWith("p-1", "176");
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("says why a weight wasn't saved", async () => {
    setPilotWeightAction.mockResolvedValue({
      ok: false,
      error: "Enter a whole number of pounds, 50 to 500.",
    });
    const user = userEvent.setup();
    render(<PilotWeightCard pilotId="p-1" weightLbs={180} />);
    await user.clear(screen.getByLabelText("Weight (lb)"));
    await user.type(screen.getByLabelText("Weight (lb)"), "30");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a whole number of pounds, 50 to 500.",
    );
  });
});
