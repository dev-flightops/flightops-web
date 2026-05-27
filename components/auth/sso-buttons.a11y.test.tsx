import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import type { ProviderSummary } from "@/lib/api/types";
import { expectNoA11yViolations } from "@/tests/a11y";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

import { SsoButtons } from "./sso-buttons";

const providers: ProviderSummary[] = [
  { id: "google", label: "Google" },
  { id: "microsoft-entra-id", label: "Microsoft" },
  { id: "okta", label: "Okta" },
];

describe("SsoButtons (a11y)", () => {
  it("three-provider list has no WCAG A/AA violations", async () => {
    const { container } = render(<SsoButtons providers={providers} />);
    await expectNoA11yViolations(container);
  });
});
