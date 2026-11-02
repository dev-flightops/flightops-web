import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createFuelSupplier, updateFuelSupplier, saveSupplierPrice, switchOffSupplierPrice, revalidatePath } =
  vi.hoisted(() => {
    class TestApiError extends Error {
      constructor(
        public status: number,
        public path: string,
        message: string,
      ) {
        super(message);
      }
    }
    return {
      TestApiError,
      createFuelSupplier: vi.fn(),
      updateFuelSupplier: vi.fn(),
      saveSupplierPrice: vi.fn(),
      switchOffSupplierPrice: vi.fn(),
      revalidatePath: vi.fn(),
    };
  });
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ createFuelSupplier, updateFuelSupplier, saveSupplierPrice, switchOffSupplierPrice }));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  addSupplierAction,
  savePriceAction,
  setPriceActiveAction,
  updateSupplierAction,
  type PriceFields,
  type SupplierFields,
} from "./directory-actions";

const FIELDS: SupplierFields = {
  name: " Tundra Fuel ",
  contact_name: "Glen Mattson",
  phone: "",
  sms_phone: " ",
  email: "orders@tundrafuel.test",
  cc_emails: "",
  account_number: "A-77",
  billing_terms: "Net 30",
  notes: "",
};

const PRICE: PriceFields = {
  base_code: "pabe",
  fuel_type_id: "ft-jet",
  price_per_gallon: "6.875",
  effective_from: "2026-11-01",
  effective_to: "",
  notes: "",
  is_contract_rate: true,
  is_default: false,
};

const ROW = {
  id: "row-1",
  supplier_id: "s-1",
  supplier_name: "Tundra Fuel",
  base_code: "PABE",
  fuel_type_id: "ft-jet",
  fuel_type_code: "JET_A",
  fuel_type_label: "Jet A",
  price_per_gallon: 6.5,
  is_contract_rate: false,
  effective_from: "2026-10-01",
  effective_to: null,
  is_default: false,
  notes: "Truck at 3",
  is_active: false,
};

beforeEach(() => vi.clearAllMocks());

describe("addSupplierAction (#134)", () => {
  it("adds the supplier with blanks as null", async () => {
    createFuelSupplier.mockResolvedValueOnce({ id: "s-9" });
    expect(await addSupplierAction(FIELDS)).toEqual({ ok: true });
    expect(createFuelSupplier).toHaveBeenCalledWith({
      name: "Tundra Fuel",
      contact_name: "Glen Mattson",
      phone: null,
      sms_phone: null,
      email: "orders@tundrafuel.test",
      cc_emails: null,
      account_number: "A-77",
      billing_terms: "Net 30",
      notes: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/fuel/suppliers");
  });

  it("needs a name, and an email that is one", async () => {
    expect(await addSupplierAction({ ...FIELDS, name: "  " })).toEqual({ ok: false, error: "Give the supplier's name." });
    expect(await addSupplierAction({ ...FIELDS, email: "orders at tundra" })).toEqual({
      ok: false,
      error: "The email doesn't look like an address.",
    });
    expect(createFuelSupplier).not.toHaveBeenCalled();
  });

  it("says who may when the service refuses", async () => {
    createFuelSupplier.mockRejectedValueOnce(new TestApiError(403, "/ground/fuel/suppliers", "{}"));
    expect((await addSupplierAction(FIELDS)).error).toMatch(/^Only the Chief Pilot, .* can change the fuel directory\.$/);
  });
});

describe("updateSupplierAction (#134)", () => {
  it("sends every field, an emptied one as null, and the active switch", async () => {
    updateFuelSupplier.mockResolvedValueOnce({ id: "s-1" });
    expect(await updateSupplierAction("s-1", FIELDS, false)).toEqual({ ok: true });
    expect(updateFuelSupplier).toHaveBeenCalledWith("s-1", expect.objectContaining({ phone: null, notes: null, is_active: false }));
    expect(Object.keys(updateFuelSupplier.mock.calls[0][1]).sort()).toEqual([...Object.keys(FIELDS), "is_active"].sort());
  });
});

describe("savePriceAction (#134)", () => {
  it("saves the price for the base and fuel, switched on", async () => {
    saveSupplierPrice.mockResolvedValueOnce(ROW);
    expect(await savePriceAction("s-1", PRICE)).toEqual({ ok: true });
    expect(saveSupplierPrice).toHaveBeenCalledWith("s-1", {
      base_code: "PABE",
      fuel_type_id: "ft-jet",
      price_per_gallon: 6.875,
      is_contract_rate: true,
      effective_from: "2026-11-01",
      effective_to: null,
      is_default: false,
      notes: null,
      is_active: true,
    });
  });

  it("keeps a blank price as none", async () => {
    saveSupplierPrice.mockResolvedValueOnce(ROW);
    await savePriceAction("s-1", { ...PRICE, price_per_gallon: " " });
    expect(saveSupplierPrice).toHaveBeenCalledWith("s-1", expect.objectContaining({ price_per_gallon: null }));
  });

  it("refuses what can't be a price", async () => {
    expect((await savePriceAction("s-1", { ...PRICE, base_code: "" })).error).toBe("Pick the base.");
    expect((await savePriceAction("s-1", { ...PRICE, fuel_type_id: "" })).error).toBe("Pick the fuel.");
    expect((await savePriceAction("s-1", { ...PRICE, price_per_gallon: "-1" })).error).toMatch(/^The price per gallon is/);
    expect((await savePriceAction("s-1", { ...PRICE, price_per_gallon: "six" })).error).toMatch(/^The price per gallon is/);
    expect((await savePriceAction("s-1", { ...PRICE, effective_to: "2026-10-31" })).error).toBe(
      "The price can't end before it starts.",
    );
    expect(saveSupplierPrice).not.toHaveBeenCalled();
  });

  it("passes on the service's own words", async () => {
    saveSupplierPrice.mockRejectedValueOnce(
      new TestApiError(404, "/ground/fuel/suppliers/s-1/bases", JSON.stringify({ detail: "fuel type ft-jet not found" })),
    );
    expect((await savePriceAction("s-1", PRICE)).error).toBe("Fuel type ft-jet not found");
  });
});

describe("setPriceActiveAction (#134)", () => {
  it("switches a price off by its row", async () => {
    switchOffSupplierPrice.mockResolvedValueOnce(ROW);
    expect(await setPriceActiveAction("s-1", { ...ROW, is_active: true }, false)).toEqual({ ok: true });
    expect(switchOffSupplierPrice).toHaveBeenCalledWith("row-1");
    expect(saveSupplierPrice).not.toHaveBeenCalled();
  });

  it("switches it on again as it was", async () => {
    saveSupplierPrice.mockResolvedValueOnce(ROW);
    await setPriceActiveAction("s-1", ROW, true);
    expect(saveSupplierPrice).toHaveBeenCalledWith("s-1", {
      base_code: "PABE",
      fuel_type_id: "ft-jet",
      price_per_gallon: 6.5,
      is_contract_rate: false,
      effective_from: "2026-10-01",
      effective_to: null,
      is_default: false,
      notes: "Truck at 3",
      is_active: true,
    });
  });
});
