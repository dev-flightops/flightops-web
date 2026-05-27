import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import { TenantProvider } from "@/lib/tenant";
import type { TenantSummary } from "@/lib/api/types";
import { expectNoA11yViolations } from "@/tests/a11y";

import { AppShell } from "./app-shell";

const acme: TenantSummary = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Acme Aviation",
  slug: "acme",
  plan: "starter",
  is_current: true,
};

describe("AppShell (a11y)", () => {
  it("renders without a11y violations around the header chrome", async () => {
    const { container } = render(
      <TenantProvider tenants={[acme]} switchTenantAction={vi.fn()}>
        <AppShell>
          <main className="container py-10">
            <h1>Dispatch</h1>
          </main>
        </AppShell>
      </TenantProvider>,
    );
    await expectNoA11yViolations(container);
  });
});
