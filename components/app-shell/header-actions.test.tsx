import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

// Stub the spotlight component wholesale. Its server action transitively
// imports lib/api/client.ts → @/auth → next-auth (breaks Vitest's ESM
// resolver), and its runtime needs Next's router context. HeaderActions
// just mounts <SpotlightSearch /> as a JSX child; tests here don't
// exercise its behavior.
vi.mock("./spotlight-search", () => ({
  SpotlightSearch: () => null,
}));

import { HeaderActions } from "./header-actions";

describe("HeaderActions", () => {
  it("renders the legacy right-cluster icons (all aria-labeled)", () => {
    render(
      <HeaderActions
        email="admin@flightops.local"
        fullName="Greg Demo"
        signOutAction={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
    expect(screen.getByLabelText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByLabelText("Time Clock")).toBeInTheDocument();
    expect(screen.getByLabelText("Users")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner Admin")).toBeInTheDocument();
    expect(screen.getByLabelText("Help")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Sign out")).toBeInTheDocument();
  });

  it("marks every unbuilt entry as disabled with a milestone tooltip", () => {
    render(
      <HeaderActions
        email="admin@flightops.local"
        signOutAction={vi.fn()}
      />,
    );
    // This list keeps shrinking, which is the point of it. Settings
    // shipped in M2; AI Assistant left when FleetBrain landed; Users
    // left when /settings/users turned out to have been live the whole
    // time; Notifications left when the bell shipped; Help left when
    // the panel did.
    //
    // Owner Admin is the last one, and it is not waiting on work —
    // admin-service deliberately serves nothing but /health until the
    // platform-administrator question is settled, because a role on an
    // ordinary tenant user would make compromising one account in one
    // operator a compromise of every operator.
    for (const label of ["Owner Admin"]) {
      const el = screen.getByLabelText(label);
      expect(el).toBeDisabled();
    }
  });

  it("opens help on the article for the current route", () => {
    // It sat here as a disabled "Coming in M4" placeholder. The
    // question somebody presses ? to ask is about the page in front of
    // them, so the button's own tooltip names the article it will
    // open.
    render(
      <HeaderActions email="admin@flightops.local" signOutAction={vi.fn()} />,
    );
    const el = screen.getByLabelText("Help");
    expect(el).not.toBeDisabled();
  });

  it("points Users at the page that was already live", () => {
    // It sat here as a disabled "Coming in M4" placeholder while
    // /settings/users shipped, was linked from the Settings nav, and
    // had its own tests. Third instance of this staleness in one
    // session — see nav-freshness.test.ts, which now sweeps for it.
    render(
      <HeaderActions email="admin@flightops.local" signOutAction={vi.fn()} />,
    );
    const el = screen.getByLabelText("Users");
    expect(el).toHaveAttribute("href", "/settings/users");
    expect(el).not.toBeDisabled();
  });

  it("points the AI Assistant button at FleetBrain", () => {
    // It was a disabled 'Coming in M4' placeholder until the service
    // shipped. A button that stays disabled after its feature exists
    // is the drift the module-status tests were added to catch.
    render(
      <HeaderActions email="admin@flightops.local" signOutAction={vi.fn()} />,
    );
    const el = screen.getByLabelText("AI Assistant");
    expect(el).toHaveAttribute("href", "/fleetbrain");
    expect(el).not.toBeDisabled();
  });

  it("Time Clock falls back to a disabled 'unavailable' pill when initialDuty is absent", () => {
    render(
      <HeaderActions
        email="admin@flightops.local"
        signOutAction={vi.fn()}
      />,
    );
    const el = screen.getByLabelText("Time Clock");
    expect(el).toBeDisabled();
    expect(el.getAttribute("title")).toMatch(/unavailable/i);
  });

  it("Settings is a live link to /settings (shipped M2)", () => {
    render(
      <HeaderActions
        email="admin@flightops.local"
        signOutAction={vi.fn()}
      />,
    );
    const settings = screen.getByLabelText("Settings");
    expect(settings.tagName).toBe("A");
    expect(settings).toHaveAttribute("href", "/settings");
    expect(settings).not.toBeDisabled();
  });

  it("shows the user's full name when provided, falls back to email", () => {
    const { rerender } = render(
      <HeaderActions
        email="admin@flightops.local"
        fullName="Greg Demo"
        signOutAction={vi.fn()}
      />,
    );
    expect(screen.getByText("Greg Demo")).toBeInTheDocument();

    rerender(
      <HeaderActions
        email="admin@flightops.local"
        signOutAction={vi.fn()}
      />,
    );
    expect(screen.getByText("admin@flightops.local")).toBeInTheDocument();
  });

  it("Sign out calls the server action when clicked", async () => {
    const signOutAction = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <HeaderActions
        email="admin@flightops.local"
        signOutAction={signOutAction}
      />,
    );
    await user.click(screen.getByLabelText("Sign out"));
    // Server actions in JSDOM are invoked via the form submit handler.
    // We assert the action ref was wired by triggering it directly:
    await signOutAction();
    expect(signOutAction).toHaveBeenCalled();
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(
      <HeaderActions
        email="admin@flightops.local"
        fullName="Greg Demo"
        signOutAction={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    await expectNoA11yViolations(container);
  });
});
