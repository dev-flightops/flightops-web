import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProviderSummary } from "@/lib/api/types";

// Stub next-auth/react before the component imports it.
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

import { signIn } from "next-auth/react";

import { SsoButtons } from "./sso-buttons";

const google: ProviderSummary = { id: "google", label: "Google" };
const entra: ProviderSummary = { id: "microsoft-entra-id", label: "Microsoft" };

describe("SsoButtons", () => {
  it("renders nothing when there are no providers", () => {
    const { container } = render(<SsoButtons providers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one button per provider with the right label", () => {
    render(<SsoButtons providers={[google, entra]} />);
    expect(
      screen.getByRole("button", { name: /Sign in with Google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sign in with Microsoft/i }),
    ).toBeInTheDocument();
  });

  it("calls signIn with the provider id and callback url when clicked", async () => {
    const user = userEvent.setup();
    render(
      <SsoButtons providers={[google]} callbackUrl="/dispatch" />,
    );
    await user.click(
      screen.getByRole("button", { name: /Sign in with Google/i }),
    );
    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/dispatch" });
  });

  it("defaults callback url to / when not specified", async () => {
    vi.mocked(signIn).mockClear();
    const user = userEvent.setup();
    render(<SsoButtons providers={[google]} />);
    await user.click(
      screen.getByRole("button", { name: /Sign in with Google/i }),
    );
    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });
});
