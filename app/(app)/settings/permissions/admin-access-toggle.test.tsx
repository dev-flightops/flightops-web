import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, setAdminAccess } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, setAdminAccess: vi.fn() };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ setAdminAccess }));

import { AdminAccessToggle } from "./admin-access-toggle";

beforeEach(() => {
  setAdminAccess.mockReset();
});

describe("AdminAccessToggle", () => {
  it("flips on click and calls the backend with the new value", async () => {
    setAdminAccess.mockResolvedValueOnce({
      id: "dispatcher",
      label: "Dispatcher",
      description: "",
      admin_access: true,
    });

    render(<AdminAccessToggle roleId="dispatcher" initial={false} />);
    const toggle = screen.getByLabelText("Admin Access for dispatcher");
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(setAdminAccess).toHaveBeenCalledWith("dispatcher", {
        admin_access: true,
      }),
    );
    expect(toggle).toBeChecked();
  });

  it("rolls back the optimistic update on 403", async () => {
    setAdminAccess.mockRejectedValueOnce(
      new TestApiError(403, "/admin-access/dispatcher", "x"),
    );

    render(<AdminAccessToggle roleId="dispatcher" initial={false} />);
    const toggle = screen.getByLabelText("Admin Access for dispatcher");

    fireEvent.click(toggle);

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert")).toHaveTextContent(/executive admin/i);
    // Optimistic update reverted.
    expect(toggle).not.toBeChecked();
  });

  it("renders exec_admin as locked-on regardless of initial flag", () => {
    render(<AdminAccessToggle roleId="exec_admin" initial={true} />);
    const toggle = screen.getByLabelText("Admin Access for exec_admin");
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
  });
});
