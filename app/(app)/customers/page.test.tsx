import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, listCustomers } = vi.hoisted(() => ({
  auth: vi.fn(),
  listCustomers: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/reservations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/reservations")>()),
  listCustomers,
}));

import CustomersListPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  listCustomers.mockResolvedValue({ items: [], total: 0 });
});

describe("/customers: who is offered New Customer (#128)", () => {
  // The DO and the accountant read the list; adding a customer stays
  // with reservations-service's MANAGE_ROLES, so the button is not
  // offered to be refused.
  it.each([
    ["dispatcher", true],
    ["reservations_agent", true],
    ["exec_admin", true],
    ["director_of_operations", false],
    ["accountant", false],
  ])("%s: %s", async (role, offered) => {
    auth.mockResolvedValue({ roles: [role] });
    render(await CustomersListPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("link", { name: "+ New Customer" }) !== null).toBe(offered);
  });
});
