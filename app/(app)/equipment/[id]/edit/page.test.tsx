import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, getGseUnit, listStations, redirectSpy } = vi.hoisted(() => ({
  auth: vi.fn(),
  getGseUnit: vi.fn(),
  listStations: vi.fn(),
  redirectSpy: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/ground", () => ({ getGseUnit, listStations }));
vi.mock("next/navigation", () => ({ redirect: redirectSpy, notFound: vi.fn() }));
vi.mock("./actions", () => ({ updateEquipmentAction: vi.fn() }));
vi.mock("../../new/new-equipment-form", () => ({
  NewEquipmentForm: ({ unit, stations, submit }: { unit: { name: string }; stations: unknown[]; submit?: unknown }) => (
    <form aria-label="unit">{`${unit.name} · ${stations.length} stations · ${submit ? "saves" : "adds"}`}</form>
  ),
}));

import EditEquipmentPage from "./page";

const UNIT = { id: "u-1", name: "GPU 2", station: { id: "s-1", icao_code: "PADU", name: "Unalaska" } };

beforeEach(() => {
  vi.clearAllMocks();
  getGseUnit.mockResolvedValue(UNIT);
  listStations.mockResolvedValue({ items: [{ id: "s-1" }, { id: "s-2" }] });
});

describe("EditEquipmentPage (#134)", () => {
  it("fills the equipment form with the unit, saving rather than adding", async () => {
    auth.mockResolvedValue({ roles: ["ground_ops"] });
    render(await EditEquipmentPage({ params: Promise.resolve({ id: "u-1" }) }));
    expect(screen.getByRole("heading", { name: "Edit Equipment" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "unit" })).toHaveTextContent("GPU 2 · 2 stations · saves");
  });

  it("says the station stays when the stations can't be read", async () => {
    auth.mockResolvedValue({ roles: ["ground_ops"] });
    listStations.mockRejectedValueOnce(new Error("down"));
    render(await EditEquipmentPage({ params: Promise.resolve({ id: "u-1" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("the unit keeps its own");
  });

  it("sends anyone else back to the unit", async () => {
    auth.mockResolvedValue({ roles: ["dispatcher"] });
    await expect(EditEquipmentPage({ params: Promise.resolve({ id: "u-1" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectSpy).toHaveBeenCalledWith("/equipment/u-1");
  });
});
