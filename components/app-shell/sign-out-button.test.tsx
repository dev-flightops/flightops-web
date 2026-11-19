import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fullPageLoad = vi.fn();
vi.mock("@/lib/navigation/full-load", () => ({ fullPageLoad: (path: string) => fullPageLoad(path) }));

import { SignOutButton } from "./sign-out-button";

describe("Sign out (#201)", () => {
  beforeEach(() => fullPageLoad.mockClear());

  it("ends the session, then loads the sign-in page in full", async () => {
    const order: string[] = [];
    const action = vi.fn(async () => {
      order.push("action");
    });
    fullPageLoad.mockImplementation((path: string) => order.push(`load ${path}`));
    render(<SignOutButton action={action} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    await vi.waitFor(() => expect(fullPageLoad).toHaveBeenCalledWith("/login"));
    expect(order).toEqual(["action", "load /login"]);
  });

  it("still leaves the page when the action fails, so nothing is left half signed out", async () => {
    const action = vi.fn(async () => {
      throw new Error("offline");
    });
    render(<SignOutButton action={action} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    await vi.waitFor(() => expect(fullPageLoad).toHaveBeenCalledWith("/login"));
  });
});
