import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi } from "vitest";

import { TenantProvider } from "@/lib/tenant";
import type { TenantSummary } from "@/lib/api/types";
import { expectNoA11yViolations } from "@/tests/a11y";

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

const renderSwitcher = (tenants: TenantSummary[]) =>
  render(
    <TenantProvider tenants={tenants} switchTenantAction={vi.fn()}>
      <TenantSwitcher />
    </TenantProvider>,
  );

describe("TenantSwitcher (a11y)", () => {
  it("single-tenant scaffold has no violations", async () => {
    const { container } = renderSwitcher([acme]);
    await expectNoA11yViolations(container);
  });

  it("multi-tenant closed state has no violations", async () => {
    const { container } = renderSwitcher([acme, beta]);
    await expectNoA11yViolations(container);
  });

  it("multi-tenant open state has no violations", async () => {
    const user = userEvent.setup();
    const { container, getByLabelText } = renderSwitcher([acme, beta]);
    await user.click(getByLabelText(/Current organization/));
    await expectNoA11yViolations(container);
  });
});
