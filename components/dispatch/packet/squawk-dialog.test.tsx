import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSquawkAction, refresh } = vi.hoisted(() => ({
  createSquawkAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/maintenance-actions", () => ({ createSquawkAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { SquawkDialog } from "./squawk-dialog";

const FLEET = [
  { id: "a-503", tail_number: "N503PA", model: "Cessna 208B Grand Caravan" },
  { id: "a-604", tail_number: "N604PA", model: "GippsAero GA8 Airvan" },
];

beforeEach(() => {
  vi.clearAllMocks();
  createSquawkAction.mockResolvedValue({ ok: true, squawk_id: "s-1" });
});

async function describeDefect(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Title"), "Left magneto drop");
  await user.type(screen.getByLabelText("Description"), "250 rpm drop on the run-up.");
}

describe("SquawkDialog", () => {
  it("files against the flight's aircraft on the packet and the preflight", async () => {
    const user = userEvent.setup();
    render(<SquawkDialog aircraftId="a-503" tailNumber="N503PA" />);
    await user.click(screen.getByRole("button", { name: "Squawk" }));
    expect(screen.getByText("New squawk · N503PA")).toBeInTheDocument();
    expect(screen.queryByLabelText("Aircraft")).not.toBeInTheDocument();

    await describeDefect(user);
    await user.click(screen.getByRole("button", { name: "File squawk" }));
    await waitFor(() =>
      expect(createSquawkAction).toHaveBeenCalledWith(
        expect.objectContaining({ aircraft_id: "a-503", title: "Left magneto drop" }),
      ),
    );
  });

  it("lets the pilot pick the aircraft from their home, before there is a flight (#92)", async () => {
    const user = userEvent.setup();
    render(<SquawkDialog choices={FLEET} />);
    await user.click(screen.getByRole("button", { name: "Squawk" }));
    expect(screen.getByText("New squawk")).toBeInTheDocument();

    await describeDefect(user);
    await user.click(screen.getByRole("button", { name: "File squawk" }));
    expect(await screen.findByText("Pick the aircraft")).toBeInTheDocument();
    expect(createSquawkAction).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Aircraft"), "a-604");
    await user.selectOptions(screen.getByLabelText("Severity"), "grounding");
    expect(screen.getByRole("alert")).toHaveTextContent("This will block dispatch on N604PA");
    await user.click(screen.getByRole("button", { name: "File squawk" }));
    await waitFor(() =>
      expect(createSquawkAction).toHaveBeenCalledWith(
        expect.objectContaining({ aircraft_id: "a-604", severity: "grounding" }),
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("takes the time it was reported on the base's clock and saves it in UTC (#200)", async () => {
    // The client's nav light squawk, 18 Nov at 4:24 PM in Bethel: the field
    // was UTC, and it was saved as reported nine hours later.
    const user = userEvent.setup();
    render(<SquawkDialog aircraftId="a-100" tailNumber="N100PA" timeZone="America/Anchorage" />);
    await user.click(screen.getByRole("button", { name: "Squawk" }));
    fireEvent.change(screen.getByLabelText("Reported at (AKST)"), { target: { value: "2026-11-18T16:24" } });
    await describeDefect(user);
    await user.click(screen.getByRole("button", { name: "File squawk" }));

    await waitFor(() => expect(createSquawkAction).toHaveBeenCalledTimes(1));
    expect(createSquawkAction.mock.calls[0][0].reported_at).toBe("2026-11-19T01:24:00Z");
  });
});

