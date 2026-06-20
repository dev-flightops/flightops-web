import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toggleAdminAccessAction } = vi.hoisted(() => ({
  toggleAdminAccessAction: vi.fn(),
}));

vi.mock("./actions", () => ({ toggleAdminAccessAction }));

import { AdminAccessToggle } from "./admin-access-toggle";

beforeEach(() => {
  toggleAdminAccessAction.mockReset();
});

describe("AdminAccessToggle", () => {
  it("flips on click and calls the server action with the new value", async () => {
    toggleAdminAccessAction.mockResolvedValueOnce({ ok: true });

    render(<AdminAccessToggle roleId="dispatcher" initial={false} />);
    const toggle = screen.getByLabelText("Admin Access for dispatcher");
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(toggleAdminAccessAction).toHaveBeenCalledWith({
        role: "dispatcher",
        admin_access: true,
      }),
    );
    expect(toggle).toBeChecked();
  });

  it("rolls back the optimistic update on forbidden", async () => {
    toggleAdminAccessAction.mockResolvedValueOnce({
      ok: false,
      error: "forbidden",
    });

    render(<AdminAccessToggle roleId="dispatcher" initial={false} />);
    const toggle = screen.getByLabelText("Admin Access for dispatcher");

    fireEvent.click(toggle);

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert")).toHaveTextContent(/executive admin/i);
    expect(toggle).not.toBeChecked();
  });

  it("shows the generic retry message on a network error", async () => {
    toggleAdminAccessAction.mockResolvedValueOnce({
      ok: false,
      error: "network",
    });

    render(<AdminAccessToggle roleId="dispatcher" initial={false} />);
    fireEvent.click(screen.getByLabelText("Admin Access for dispatcher"));

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert")).toHaveTextContent(/try again/i);
  });

  it("renders exec_admin as locked-on regardless of initial flag", () => {
    render(<AdminAccessToggle roleId="exec_admin" initial={true} />);
    const toggle = screen.getByLabelText("Admin Access for exec_admin");
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
  });
});
