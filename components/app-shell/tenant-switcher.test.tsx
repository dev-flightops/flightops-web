import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TenantProvider } from "@/lib/tenant";
import type { TenantSummary } from "@/lib/api/types";

import { TenantSwitcher } from "./tenant-switcher";

const acme: TenantSummary = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Acme Aviation",
  slug: "acme",
  plan: "starter",
  is_current: true,
};

const beta: TenantSummary = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Beta Charter",
  slug: "beta",
  plan: "owner",
  is_current: false,
};

const renderSwitcher = (
  tenants: TenantSummary[],
  switchTenantAction = vi.fn().mockResolvedValue(undefined),
) =>
  render(
    <TenantProvider tenants={tenants} switchTenantAction={switchTenantAction}>
      <TenantSwitcher />
    </TenantProvider>,
  );

describe("TenantSwitcher", () => {
  it("shows the current tenant name", () => {
    renderSwitcher([acme]);
    expect(screen.getByText("Acme Aviation")).toBeInTheDocument();
  });

  it("hides the chevron and disables the dropdown when there is only one tenant", () => {
    renderSwitcher([acme]);
    const summary = screen.getByLabelText(/Current organization/);
    // Single-tenant scaffold: no aria-haspopup advertised
    expect(summary).not.toHaveAttribute("aria-haspopup");
  });

  it("renders all tenants in the menu when multi-tenant", async () => {
    const user = userEvent.setup();
    renderSwitcher([acme, beta]);

    await user.click(screen.getByLabelText(/Current organization/));

    expect(
      screen.getByRole("menuitemradio", { name: /Acme Aviation/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: /Beta Charter/ }),
    ).toBeInTheDocument();
  });

  it("calls switchTenantAction when a different tenant is picked", async () => {
    const user = userEvent.setup();
    const switchTenantAction = vi.fn().mockResolvedValue(undefined);
    renderSwitcher([acme, beta], switchTenantAction);

    await user.click(screen.getByLabelText(/Current organization/));
    await user.click(
      screen.getByRole("menuitemradio", { name: /Beta Charter/ }),
    );

    expect(switchTenantAction).toHaveBeenCalledWith(beta.id);
  });

  it("does NOT call switchTenantAction when the current tenant is picked", async () => {
    const user = userEvent.setup();
    const switchTenantAction = vi.fn().mockResolvedValue(undefined);
    renderSwitcher([acme, beta], switchTenantAction);

    await user.click(screen.getByLabelText(/Current organization/));
    await user.click(
      screen.getByRole("menuitemradio", { name: /Acme Aviation/ }),
    );

    expect(switchTenantAction).not.toHaveBeenCalled();
  });

  it("marks the current tenant with aria-checked=true", async () => {
    const user = userEvent.setup();
    renderSwitcher([acme, beta]);

    await user.click(screen.getByLabelText(/Current organization/));

    const current = screen.getByRole("menuitemradio", {
      name: /Acme Aviation/,
    });
    expect(current).toHaveAttribute("aria-checked", "true");
  });
});
