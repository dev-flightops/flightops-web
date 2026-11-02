import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addSupplierLoginAction, setSupplierLoginActiveAction, setSupplierLoginPasswordAction, refresh } = vi.hoisted(
  () => ({
    addSupplierLoginAction: vi.fn(),
    setSupplierLoginActiveAction: vi.fn(),
    setSupplierLoginPasswordAction: vi.fn(),
    refresh: vi.fn(),
  }),
);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(app)/fuel/suppliers/actions", () => ({
  addSupplierLoginAction,
  setSupplierLoginActiveAction,
  setSupplierLoginPasswordAction,
}));

import { SupplierLogins } from "./supplier-logins";

const GLEN = {
  id: "b-1",
  account_id: "acc-1",
  full_name: "Glen Mattson",
  email: "glen@tundrafuel.test",
  is_active: true,
  last_login_at: null,
  serves_others: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SupplierLogins (#134)", () => {
  it("lists the logins, and leaves a shared account's password to its rep", () => {
    render(
      <SupplierLogins
        supplierId="s-1"
        supplierName="Tundra Fuel"
        logins={[GLEN, { ...GLEN, id: "b-2", full_name: "Ann Ruth", email: "ann@tundrafuel.test", serves_others: true }]}
      />,
    );
    const glen = screen.getByRole("row", { name: /Glen Mattson/ });
    expect(within(glen).getByText("Never")).toBeInTheDocument();
    expect(within(glen).getByRole("button", { name: "New password" })).toBeInTheDocument();
    const ann = screen.getByRole("row", { name: /Ann Ruth/ });
    expect(within(ann).queryByRole("button", { name: "New password" })).toBeNull();
    expect(within(ann).getByText(/the password is theirs/)).toBeInTheDocument();
  });

  it("says what a supplier without a login means for their orders", () => {
    render(<SupplierLogins supplierId="s-1" supplierName="Tundra Fuel" logins={[]} />);
    expect(screen.getByText(/No login yet: fuel orders tell dispatch to call them/)).toBeInTheDocument();
  });

  it("switches a login off", async () => {
    setSupplierLoginActiveAction.mockResolvedValue({ ok: true });
    render(<SupplierLogins supplierId="s-1" supplierName="Tundra Fuel" logins={[GLEN]} />);
    await userEvent.click(screen.getByRole("button", { name: "Switch off" }));
    await waitFor(() => expect(setSupplierLoginActiveAction).toHaveBeenCalledWith("s-1", "b-1", false));
    expect(refresh).toHaveBeenCalled();
  });

  it("adds a login and says how they sign in", async () => {
    addSupplierLoginAction.mockResolvedValue({
      ok: true,
      message: "Glen Mattson can sign in at /fuel-supplier/login with glen@tundrafuel.test and that password.",
    });
    render(<SupplierLogins supplierId="s-1" supplierName="Tundra Fuel" logins={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Add login" }));
    const form = screen.getByRole("form", { name: "Add a login for Tundra Fuel" });
    await userEvent.type(within(form).getByLabelText("Name"), "Glen Mattson");
    await userEvent.type(within(form).getByLabelText("Email"), "glen@tundrafuel.test");
    await userEvent.type(within(form).getByLabelText(/^Password/), "tundra-pass-1");
    await userEvent.click(within(form).getByRole("button", { name: "Add login" }));
    await waitFor(() =>
      expect(addSupplierLoginAction).toHaveBeenCalledWith("s-1", {
        full_name: "Glen Mattson",
        email: "glen@tundrafuel.test",
        password: "tundra-pass-1",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/can sign in at \/fuel-supplier\/login/);
  });

  it("shows why a change was refused", async () => {
    setSupplierLoginPasswordAction.mockResolvedValue({
      ok: false,
      error: "This login also serves another operator, so its password stays the supplier's.",
    });
    render(<SupplierLogins supplierId="s-1" supplierName="Tundra Fuel" logins={[GLEN]} />);
    await userEvent.click(screen.getByRole("button", { name: "New password" }));
    await userEvent.type(screen.getByLabelText("New password for Glen Mattson"), "new-pass-22");
    await userEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/password stays the supplier's/);
  });
});
