import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/portal" }));

import { AppShellHeader } from "./app-shell-header";
import { ExternalActions } from "./identity";

const signOut = vi.fn(async () => {});

describe("the bar a customer or supplier login gets", () => {
  it("has their name and Sign out, and none of the staff controls", () => {
    render(<ExternalActions displayName="Ella Ramirez" signOutAction={signOut} />);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByTitle("Ella Ramirez")).toBeInTheDocument();
    for (const staffOnly of [/notifications/i, /ai/i, /clock/i, /users/i, /settings/i, /help/i, /search/i]) {
      expect(screen.queryByRole("button", { name: staffOnly })).toBeNull();
      expect(screen.queryByRole("link", { name: staffOnly })).toBeNull();
    }
  });

  it("links the operator's name to the portal and leaves out the department strip", () => {
    render(
      <AppShellHeader
        brand="Peregrine Demo Airlines"
        homeHref="/portal"
        showDepartmentNav={false}
        roles={[]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Peregrine Demo Airlines" }),
    ).toHaveAttribute("href", "/portal");
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: "Ops" })).toBeNull();
  });
});
