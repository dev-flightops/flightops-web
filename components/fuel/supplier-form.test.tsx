import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addSupplierAction, updateSupplierAction, refresh } = vi.hoisted(() => ({
  addSupplierAction: vi.fn(),
  updateSupplierAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(app)/fuel/suppliers/directory-actions", () => ({ addSupplierAction, updateSupplierAction }));

import { SupplierForm, SupplierHeader } from "./supplier-form";

const TUNDRA = {
  id: "s-1",
  name: "Tundra Fuel",
  contact_name: "Glen Mattson",
  phone: "907-555-0100",
  sms_phone: null,
  email: "orders@tundrafuel.test",
  cc_emails: null,
  account_number: "A-77",
  billing_terms: "Net 30",
  notes: null,
  is_active: true,
};

beforeEach(() => vi.clearAllMocks());

describe("SupplierForm (#134)", () => {
  it("adds a supplier with every field as typed, then clears for the next", async () => {
    addSupplierAction.mockResolvedValue({ ok: true });
    render(<SupplierForm />);
    const form = screen.getByRole("form", { name: "Add a supplier" });
    await userEvent.type(within(form).getByLabelText("Name"), "Bethel Fuel");
    await userEvent.type(within(form).getByLabelText("Phone"), "907-555-0199");
    await userEvent.click(within(form).getByRole("button", { name: "Add supplier" }));
    await waitFor(() =>
      expect(addSupplierAction).toHaveBeenCalledWith({
        name: "Bethel Fuel",
        contact_name: "",
        phone: "907-555-0199",
        sms_phone: "",
        email: "",
        cc_emails: "",
        account_number: "",
        billing_terms: "",
        notes: "",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Bethel Fuel is in the directory.");
    expect(within(form).getByLabelText("Name")).toHaveValue("");
    expect(within(form).queryByLabelText(/^Active/)).toBeNull();
  });

  it("says why it wasn't added", async () => {
    addSupplierAction.mockResolvedValue({ ok: false, error: "The email doesn't look like an address." });
    render(<SupplierForm />);
    await userEvent.type(screen.getByLabelText("Name"), "Bethel Fuel");
    await userEvent.click(screen.getByRole("button", { name: "Add supplier" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The email doesn't look like an address.");
  });
});

describe("SupplierHeader (#134)", () => {
  it("offers nothing to change to those who don't keep the directory", () => {
    render(<SupplierHeader supplier={TUNDRA} canEdit={false} />);
    expect(screen.getByRole("heading", { name: "Tundra Fuel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("edits the supplier in a form filled with it, switched off with its Active box", async () => {
    updateSupplierAction.mockResolvedValue({ ok: true });
    render(<SupplierHeader supplier={TUNDRA} canEdit />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = screen.getByRole("form", { name: "Edit Tundra Fuel" });
    expect(within(form).getByLabelText("Contact")).toHaveValue("Glen Mattson");
    await userEvent.clear(within(form).getByLabelText("Phone"));
    await userEvent.click(within(form).getByLabelText(/^Active/));
    await userEvent.click(within(form).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateSupplierAction).toHaveBeenCalledWith("s-1", expect.objectContaining({ phone: "", name: "Tundra Fuel" }), false),
    );
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
    expect(refresh).toHaveBeenCalled();
  });
});
