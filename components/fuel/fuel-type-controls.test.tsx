import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addFuelTypeAction, setFuelTypeActiveAction, refresh } = vi.hoisted(() => ({
  addFuelTypeAction: vi.fn(),
  setFuelTypeActiveAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(app)/fuel/types/actions", () => ({ addFuelTypeAction, setFuelTypeActiveAction }));

import { AddFuelTypeForm, FuelTypeSwitch } from "./fuel-type-controls";

beforeEach(() => vi.clearAllMocks());

describe("fuel type controls (#134)", () => {
  it("switches a type off", async () => {
    setFuelTypeActiveAction.mockResolvedValue({ ok: true });
    render(<FuelTypeSwitch typeId="ft-1" label="Mogas" active />);
    await userEvent.click(screen.getByRole("button", { name: "Switch off Mogas" }));
    await waitFor(() => expect(setFuelTypeActiveAction).toHaveBeenCalledWith("ft-1", false));
    expect(refresh).toHaveBeenCalled();
  });

  it("says why a switch was refused", async () => {
    setFuelTypeActiveAction.mockResolvedValue({ ok: false, error: "Couldn't switch the fuel type back on." });
    render(<FuelTypeSwitch typeId="ft-1" label="Mogas" active={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Switch on Mogas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't switch the fuel type back on.");
  });

  it("adds a type, its code left to be made from the label", async () => {
    addFuelTypeAction.mockResolvedValue({ ok: true });
    render(<AddFuelTypeForm />);
    await userEvent.type(screen.getByLabelText("Label"), "Jet A + Prist");
    await userEvent.click(screen.getByRole("button", { name: "Add fuel type" }));
    await waitFor(() =>
      expect(addFuelTypeAction).toHaveBeenCalledWith({ label: "Jet A + Prist", code: "", sort_order: "100" }),
    );
    expect(screen.getByLabelText("Label")).toHaveValue("");
  });
});
