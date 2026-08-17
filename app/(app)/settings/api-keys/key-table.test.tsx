import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ApiKeyRow } from "@/lib/api/api-keys";

import { KeyTable } from "./key-table";

function key(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: "k-1",
    name: "Partner portal",
    key_prefix: "pfo_live_kJ8xQ2",
    created_at: "2026-08-01T10:00:00Z",
    last_used_at: "2026-08-14T09:30:00Z",
    expires_at: null,
    revoked_at: null,
    is_active: true,
    ...overrides,
  };
}

describe("KeyTable", () => {
  it("shows the name and the non-secret prefix only", () => {
    // Only a SHA-256 hash of the key is stored, so the prefix is the
    // most that can ever be displayed — there is no full value to leak.
    render(<KeyTable keys={[key()]} />);
    expect(screen.getByText("Partner portal")).toBeInTheDocument();
    expect(screen.getByText(/pfo_live_kJ8xQ2/)).toBeInTheDocument();
  });

  it("shows 'Never' for a key nobody has used", () => {
    // Actionable rather than cosmetic: an unused key is one you can
    // probably revoke.
    render(<KeyTable keys={[key({ last_used_at: null })]} />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("distinguishes revoked from expired", () => {
    // Revoked means a person acted; expired means the clock ran out.
    // Collapsing both into "inactive" would hide which follow-up is
    // needed when auditing access.
    render(
      <KeyTable
        keys={[
          key({ id: "a", name: "Turned off", revoked_at: "2026-08-10T00:00:00Z", is_active: false }),
          key({ id: "b", name: "Lapsed", expires_at: "2026-08-01T00:00:00Z", is_active: false }),
        ]}
      />,
    );
    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("treats a future expiry as still active", () => {
    render(
      <KeyTable keys={[key({ expires_at: "2099-01-01T00:00:00Z" })]} />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("offers the revoke control only on active keys", () => {
    render(
      <KeyTable
        keys={[
          key({ id: "a", name: "Live", is_active: true }),
          key({ id: "b", name: "Dead", is_active: false, revoked_at: "2026-08-10T00:00:00Z" }),
        ]}
        renderRevoke={(k) => <button type="button">Revoke {k.name}</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Revoke Live" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revoke Dead" }),
    ).not.toBeInTheDocument();
  });

  it("renders an empty state rather than a bare table", () => {
    render(<KeyTable keys={[]} />);
    expect(screen.getByText(/no api keys yet/i)).toBeInTheDocument();
  });
});
