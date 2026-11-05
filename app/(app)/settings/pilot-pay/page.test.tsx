import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getPilotPay: vi.fn(), listStaff: vi.fn(), listAircraft: vi.fn() };
});
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/api/client", () => ({ ApiError: mocks.TestApiError, apiFetch: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ getPilotPay: mocks.getPilotPay, listStaff: mocks.listStaff }));
vi.mock("@/lib/api/ops", () => ({ listAircraft: mocks.listAircraft }));
vi.mock("./actions", () => ({
  addPayRateAction: vi.fn(),
  addPayModifierAction: vi.fn(),
  removePayRateAction: Object.assign(vi.fn(), { bind: () => vi.fn() }),
  removePayModifierAction: Object.assign(vi.fn(), { bind: () => vi.fn() }),
}));

import SettingsPilotPayPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPilotPay.mockResolvedValue({
    rates: [
      {
        id: "r-1",
        rate_type: "daily",
        crew_member_id: "u-1",
        airframe_type: "caravan",
        year_of_service_min: null,
        year_of_service_max: null,
        rate_amount: "350.00",
        effective_date: "2026-11-01",
        end_date: null,
      },
    ],
    modifiers: [
      { id: "m-1", modifier_name: "medevac", display_label: "Medevac Premium", modifier_type: "flat", modifier_value: "150.00" },
    ],
  });
  mocks.listStaff.mockResolvedValue({
    items: [
      { id: "u-1", full_name: "Bob Henderson", email: "b@x", roles: ["pilot"] },
      { id: "u-2", full_name: "Sarah Kessler", email: "s@x", roles: ["chief_pilot", "pilot"] },
      { id: "u-3", full_name: "Dana Whitfield", email: "d@x", roles: ["dispatcher"] },
    ],
  });
  mocks.listAircraft.mockResolvedValue({ items: [{ airframe_type: "caravan", model: "Cessna 208" }] });
});

describe("Settings → Pilot Pay (#134)", () => {
  it("offers working forms, with nothing disabled and no developer notes", async () => {
    const { container } = render(await SettingsPilotPayPage());
    const form = screen.getByRole("form", { name: "Add pay rate" });
    expect(within(form).getByRole("button", { name: "+ Add Rate" })).toBeEnabled();
    expect(within(screen.getByRole("form", { name: "Add modifier" })).getByRole("button", { name: "+ Add Modifier" })).toBeEnabled();
    expect(container.querySelector('[aria-disabled="true"], [disabled]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/follow-up|endpoints/);
  });

  it("names a rate's pilot, and picks from the pilots only", async () => {
    render(await SettingsPilotPayPage());
    expect(screen.getByRole("row", { name: /Bob Henderson/ })).toHaveTextContent("$350.00/day");
    const picker = screen.getByRole("combobox", { name: "Pilot" });
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All Pilots (Default)",
      "Bob Henderson",
      "Sarah Kessler",
    ]);
  });

  it("gives every row a Remove", async () => {
    render(await SettingsPilotPayPage());
    expect(screen.getByRole("button", { name: "Remove the daily rate effective 2026-11-01" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove Medevac Premium" })).toBeEnabled();
  });

  it("says payroll doesn't read the tables yet", async () => {
    render(await SettingsPilotPayPage());
    expect(screen.getByText(/its pay events read the most specific rate/)).toBeInTheDocument();
  });

  it("offers no forms when the page couldn't load", async () => {
    mocks.getPilotPay.mockRejectedValue(new mocks.TestApiError(403, "/x", "forbidden"));
    render(await SettingsPilotPayPage());
    expect(screen.getByRole("alert")).toHaveTextContent("Exec Admin role required");
    expect(screen.queryByRole("form", { name: "Add pay rate" })).not.toBeInTheDocument();
  });

  it("keeps the page when the names can't be read", async () => {
    mocks.listStaff.mockRejectedValue(new Error("down"));
    mocks.listAircraft.mockRejectedValue(new Error("down"));
    render(await SettingsPilotPayPage());
    expect(screen.getByRole("row", { name: /A specific pilot/ })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Add pay rate" })).toBeInTheDocument();
  });
});
