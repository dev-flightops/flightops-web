import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { ApiError } from "@/lib/api/client";
import { deleteRefusal } from "./delete-refusal";

describe("deleteRefusal (1119-30)", () => {
  it("shows the server's own reason for a record that stays", () => {
    const body = JSON.stringify({ detail: { error: "flight_departed", message: "It departed, so it stays on record." } });
    expect(deleteRefusal(new ApiError(409, "/ops/flights/x", body), "flight")).toBe("It departed, so it stays on record.");
  });

  it("says who may delete, and when it's already gone", () => {
    expect(deleteRefusal(new ApiError(403, "/x", "forbidden"), "work order")).toBe("Only an Exec Admin can delete a work order.");
    expect(deleteRefusal(new ApiError(404, "/x", "not found"), "customer")).toBe("This customer is already gone.");
  });

  it("falls back to a plain line for a 409 without a reason, or anything else", () => {
    expect(deleteRefusal(new ApiError(409, "/x", "Conflict"), "flight")).toBe(
      "This flight is part of the record, so it can't be deleted.",
    );
    expect(deleteRefusal(new Error("network"), "flight")).toBe("Couldn't delete the flight. Please try again.");
  });
});
