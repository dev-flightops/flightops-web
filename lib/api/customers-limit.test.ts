import { describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn(async () => ({ items: [], total: 0 })) }));
vi.mock("./client", () => ({ apiFetch }));

import { CUSTOMERS_MAX_LIMIT, listCustomers } from "./reservations";

describe("the customer list (#137)", () => {
  it("never asks for more than reservations-service allows", async () => {
    // It answers 422 over 200: the booking search asked for 500, got no
    // customers, and its typeahead never listed anyone.
    await listCustomers({ limit: 500 });
    expect(apiFetch).toHaveBeenCalledWith(`/reservations/customers?limit=${CUSTOMERS_MAX_LIMIT}`);
    expect(CUSTOMERS_MAX_LIMIT).toBe(200);
  });
});
