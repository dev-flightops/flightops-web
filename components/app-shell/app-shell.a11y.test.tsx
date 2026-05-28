import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import { TenantProvider } from "@/lib/tenant";
import type { TenantSummary } from "@/lib/api/types";
import { expectNoA11yViolations } from "@/tests/a11y";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/dispatch"),
}));

import { AppShell } from "./app-shell";
import { UserMenu } from "./user-menu";

const acme: TenantSummary = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Acme Aviation",
  slug: "acme",
  plan: "starter",
  is_current: true,
};

describe("AppShell (a11y)", () => {
  it("renders without a11y violations on a dispatch route (live department)", async () => {
    const { container } = render(
      <TenantProvider tenants={[acme]} switchTenantAction={vi.fn()}>
        <AppShell
          userSlot={
            <UserMenu
              email="admin@flightops.local"
              signOutAction={vi.fn().mockResolvedValue(undefined)}
            />
          }
        >
          <div className="container py-10">
            <h1>Dispatch</h1>
          </div>
        </AppShell>
      </TenantProvider>,
    );
    await expectNoA11yViolations(container);
  });
});
