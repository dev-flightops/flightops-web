import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, redirect, listStations } = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ roles: ["director_of_maintenance"] as string[] })),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
  listStations: vi.fn(async () => ({ items: [], total: 0 })),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/ground", () => ({ listStations }));
vi.mock("./new-equipment-form", () => ({ NewEquipmentForm: () => <form aria-label="unit" /> }));

import NewEquipmentPage from "./page";

beforeEach(() => {
  listStations.mockClear();
});

describe("/equipment/new: who adds equipment (29 Sep)", () => {
  it("shows the DOM the form", async () => {
    render(await NewEquipmentPage());
    expect(screen.getByRole("form", { name: "unit" })).toBeInTheDocument();
  });

  it.each(["dispatcher", "maintenance"])("sends a %s back to the list", async (role) => {
    auth.mockResolvedValueOnce({ roles: [role] });
    await expect(NewEquipmentPage()).rejects.toThrow("NEXT_REDIRECT /equipment");
    expect(listStations).not.toHaveBeenCalled();
  });
});
