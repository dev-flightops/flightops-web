import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setInstrumentApproachAction, refresh } = vi.hoisted(() => ({
  setInstrumentApproachAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/village-wx/actions", () => ({ setInstrumentApproachAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ApproachToggle } from "./approach-toggle";

describe("ApproachToggle (#110)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says the minimums hold a field without an approach, and offers no switch to others", () => {
    render(<ApproachToggle airportId="a-1" icao="PAII" hasApproach={false} canSet={false} />);
    expect(screen.getByText(/No instrument approach: dispatch minimums hold every flight/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lets the DO mark an approach, and refreshes", async () => {
    setInstrumentApproachAction.mockResolvedValue({ ok: true });
    render(<ApproachToggle airportId="a-1" icao="PAII" hasApproach={false} canSet />);
    await userEvent.click(screen.getByRole("button", { name: "Mark PAII as having an instrument approach" }));
    expect(setInstrumentApproachAction).toHaveBeenCalledWith("a-1", true);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("says why when it isn't saved", async () => {
    setInstrumentApproachAction.mockResolvedValue({
      ok: false,
      error: "Only the Director of Operations or an Exec Admin can change this.",
    });
    render(<ApproachToggle airportId="a-1" icao="PAEM" hasApproach canSet />);
    await userEvent.click(screen.getByRole("button", { name: "Mark PAEM as having no instrument approach" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Director of Operations/);
  });
});
