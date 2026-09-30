import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { auth, redirect } = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ roles: ["ground_ops"] as string[] })),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./new-station-form", () => ({ NewStationForm: () => <form aria-label="station" /> }));

import NewStationPage from "./page";

describe("/stations/new: who adds stations (29 Sep)", () => {
  it("shows Ground Ops the form", async () => {
    render(await NewStationPage());
    expect(screen.getByRole("heading", { name: "Add Station" })).toBeInTheDocument();
  });

  it.each(["dispatcher", "director_of_maintenance"])(
    "sends a %s back to the list",
    async (role) => {
      auth.mockResolvedValueOnce({ roles: [role] });
      await expect(NewStationPage()).rejects.toThrow("NEXT_REDIRECT /stations");
    },
  );
});
