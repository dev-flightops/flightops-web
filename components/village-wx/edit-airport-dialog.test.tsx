import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { editVillageAirportAction, retireVillageAirportAction, refresh } = vi.hoisted(() => ({
  editVillageAirportAction: vi.fn(),
  retireVillageAirportAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/village-wx/actions", () => ({
  editVillageAirportAction,
  retireVillageAirportAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import type { VillageAirportResponse } from "@/lib/api/types";

import { EditAirportDialog } from "./edit-airport-dialog";

const LEVELOCK: VillageAirportResponse = {
  id: "a-9",
  icao: "PAAI",
  name: "Levelock",
  region: "Bristol Bay",
  is_active: true,
  notes: null,
};

describe("EditAirportDialog (#130)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("corrects Levelock's identifier to 9Z8", async () => {
    editVillageAirportAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditAirportDialog airport={LEVELOCK} />);
    await user.click(screen.getByRole("button", { name: "Edit PAAI" }));
    const dialog = screen.getByRole("dialog");
    const icao = within(dialog).getByLabelText("Identifier");
    expect(icao).toHaveValue("PAAI");
    await user.clear(icao);
    await user.type(icao, "9Z8");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(editVillageAirportAction).toHaveBeenCalledWith("a-9", {
      icao: "9Z8",
      name: "Levelock",
      region: "Bristol Bay",
      notes: "",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps what was typed and marks the identifier when another airport has it", async () => {
    editVillageAirportAction.mockResolvedValue({
      ok: false,
      error: "Check the fields marked.",
      errors: { icao: "Another airport, a retired one included, has that identifier." },
    });
    const user = userEvent.setup();
    render(<EditAirportDialog airport={LEVELOCK} />);
    await user.click(screen.getByRole("button", { name: "Edit PAAI" }));
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Identifier"));
    await user.type(within(dialog).getByLabelText("Identifier"), "PABE");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText("Another airport, a retired one included, has that identifier."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Identifier")).toHaveValue("PABE");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("asks before retiring, and keeps the reports", async () => {
    retireVillageAirportAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditAirportDialog airport={LEVELOCK} />);
    await user.click(screen.getByRole("button", { name: "Edit PAAI" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Retire…" }));
    expect(
      within(dialog).getByText("Retire Levelock (PAAI)? It comes off the board, and its reports are kept."),
    ).toBeInTheDocument();
    expect(retireVillageAirportAction).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Retire" }));
    expect(retireVillageAirportAction).toHaveBeenCalledWith("a-9");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
