import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { savePriceAction, setPriceActiveAction, refresh } = vi.hoisted(() => ({
  savePriceAction: vi.fn(),
  setPriceActiveAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(app)/fuel/suppliers/directory-actions", () => ({ savePriceAction, setPriceActiveAction }));

import { SupplierPrices } from "./supplier-prices";

const JET_AT_PABE = {
  id: "row-1",
  supplier_id: "s-1",
  supplier_name: "Tundra Fuel",
  base_code: "PABE",
  fuel_type_id: "ft-jet",
  fuel_type_code: "JET_A",
  fuel_type_label: "Jet A",
  price_per_gallon: 6.875,
  is_contract_rate: true,
  effective_from: "2026-10-01",
  effective_to: null,
  is_default: true,
  notes: null,
  is_active: true,
};
const AVGAS_OFF = {
  ...JET_AT_PABE,
  id: "row-2",
  fuel_type_id: "ft-avgas",
  fuel_type_label: "100LL",
  price_per_gallon: 8.5,
  is_contract_rate: false,
  is_default: false,
  is_active: false,
};
const STATIONS = [
  { code: "PABE", name: "Bethel" },
  { code: "PAEM", name: "Emmonak" },
];
const TYPES = [
  { id: "ft-jet", label: "Jet A" },
  { id: "ft-avgas", label: "100LL" },
];

function prices(canEdit: boolean, stations: typeof STATIONS | null = STATIONS) {
  return render(
    <SupplierPrices
      supplierId="s-1"
      supplierName="Tundra Fuel"
      rows={[JET_AT_PABE, AVGAS_OFF]}
      canEdit={canEdit}
      stations={stations}
      fuelTypes={TYPES}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("SupplierPrices (#134)", () => {
  it("shows each price, a switched-off one marked, and nothing to change for others", () => {
    prices(false);
    const jet = screen.getByRole("row", { name: /Jet A/ });
    expect(within(jet).getByText("$6.875")).toBeInTheDocument();
    expect(within(jet).getByText("Contract")).toBeInTheDocument();
    expect(within(jet).getByText("Default")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /100LL/ })).getByText("Off")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("switches a price off, and a switched-off one on, for the directory's keepers", async () => {
    setPriceActiveAction.mockResolvedValue({ ok: true });
    prices(true);
    await userEvent.click(within(screen.getByRole("row", { name: /Jet A/ })).getByRole("button", { name: "Switch off" }));
    await waitFor(() => expect(setPriceActiveAction).toHaveBeenCalledWith("s-1", JET_AT_PABE, false));
    await userEvent.click(within(screen.getByRole("row", { name: /100LL/ })).getByRole("button", { name: "Switch on" }));
    await waitFor(() => expect(setPriceActiveAction).toHaveBeenCalledWith("s-1", AVGAS_OFF, true));
    expect(refresh).toHaveBeenCalled();
  });

  it("changes a price with its base and fuel kept", async () => {
    savePriceAction.mockResolvedValue({ ok: true });
    prices(true);
    await userEvent.click(within(screen.getByRole("row", { name: /Jet A/ })).getByRole("button", { name: "Edit" }));
    const form = screen.getByRole("form", { name: "Price for Jet A at PABE" });
    expect(within(form).queryByRole("combobox")).toBeNull();
    const price = within(form).getByLabelText("Price / gal ($)");
    expect(price).toHaveValue(6.875);
    await userEvent.clear(price);
    await userEvent.type(price, "7.125");
    await userEvent.click(within(form).getByRole("button", { name: "Save price" }));
    await waitFor(() =>
      expect(savePriceAction).toHaveBeenCalledWith("s-1", {
        base_code: "PABE",
        fuel_type_id: "ft-jet",
        price_per_gallon: "7.125",
        effective_from: "2026-10-01",
        effective_to: "",
        notes: "",
        is_contract_rate: true,
        is_default: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
  });

  it("sets a new price at one of the company's stations", async () => {
    savePriceAction.mockResolvedValue({ ok: false, error: "Couldn't save the price. Try again in a moment." });
    prices(true);
    await userEvent.click(screen.getByRole("button", { name: "+ Set a price" }));
    const form = screen.getByRole("form", { name: "Set a price from Tundra Fuel" });
    await userEvent.selectOptions(within(form).getByLabelText("Base"), "PAEM");
    await userEvent.selectOptions(within(form).getByLabelText("Fuel"), "ft-avgas");
    await userEvent.type(within(form).getByLabelText("Price / gal ($)"), "9.25");
    await userEvent.click(within(form).getByRole("button", { name: "Save price" }));
    await waitFor(() =>
      expect(savePriceAction).toHaveBeenCalledWith(
        "s-1",
        expect.objectContaining({ base_code: "PAEM", fuel_type_id: "ft-avgas", price_per_gallon: "9.25", is_default: false }),
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the price.");
    expect(screen.getByRole("form", { name: "Set a price from Tundra Fuel" })).toBeInTheDocument();
  });

  it("takes the base typed when the stations couldn't be read", async () => {
    prices(true, null);
    await userEvent.click(screen.getByRole("button", { name: "+ Set a price" }));
    expect(screen.getByLabelText("Base").tagName).toBe("INPUT");
  });
});
