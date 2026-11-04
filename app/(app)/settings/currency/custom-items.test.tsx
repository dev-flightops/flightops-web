import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  renameCustomItemAction: vi.fn(),
  setCustomItemActiveAction: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("./actions", () => ({
  addCustomItemAction: vi.fn(),
  renameCustomItemAction: mocks.renameCustomItemAction,
  setCustomItemActiveAction: mocks.setCustomItemActiveAction,
}));

import type { CurrencyItemRef } from "@/lib/api/types";

import { CustomItemActions, NewCustomItemForm } from "./custom-items";

const item = (over: Partial<CurrencyItemRef> = {}): CurrencyItemRef => ({
  id: "c-1",
  code: "fire_drill",
  name: "Fire Drill",
  regulation: "Company GOM 4.2",
  interval_type: "annual",
  requires_examiner: false,
  is_check_event: false,
  is_initial_only: false,
  rolling_days: null,
  rolling_threshold: null,
  sort_order: 500,
  is_default: false,
  is_active: true,
  ...over,
});

const confirm = vi.spyOn(window, "confirm");

beforeEach(() => vi.clearAllMocks());

describe("NewCustomItemForm (#134)", () => {
  it("asks for the window only for a rolling item", async () => {
    render(<NewCustomItemForm />);
    expect(screen.queryByRole("spinbutton", { name: "Days" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Interval" }), "rolling_days");
    expect(screen.getByRole("spinbutton", { name: "Days" })).toBeRequired();
    expect(screen.getByRole("spinbutton", { name: "How many" })).toBeRequired();
  });

  it("says who it applies to, and what dispatch will see", () => {
    render(<NewCustomItemForm />);
    expect(screen.getByText(/applies to every pilot/)).toHaveTextContent("warning to acknowledge at release");
  });

  it("is what the page's + New Custom Item jumps to", () => {
    const { container } = render(<NewCustomItemForm />);
    expect(container.querySelector("#new-custom-item")).not.toBeNull();
  });
});

describe("CustomItemActions (#134)", () => {
  it("edits the name and reference", async () => {
    mocks.renameCustomItemAction.mockResolvedValue({ ok: true });
    render(<CustomItemActions item={item()} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Fire Drill" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Fire Drill Annual");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.renameCustomItemAction).toHaveBeenCalledWith("c-1", "Fire Drill Annual", "Company GOM 4.2");
    expect(screen.queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument();
  });

  it("keeps the edit open and says why when it fails", async () => {
    mocks.renameCustomItemAction.mockResolvedValue({ ok: false, error: "Enter a name under 128 characters." });
    render(<CustomItemActions item={item()} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Fire Drill" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a name");
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
  });

  it("deactivates only once confirmed", async () => {
    confirm.mockReturnValueOnce(false);
    mocks.setCustomItemActiveAction.mockResolvedValue({ ok: true });
    render(<CustomItemActions item={item()} />);
    await userEvent.click(screen.getByRole("button", { name: "Deactivate Fire Drill" }));
    expect(mocks.setCustomItemActiveAction).not.toHaveBeenCalled();
    confirm.mockReturnValueOnce(true);
    await userEvent.click(screen.getByRole("button", { name: "Deactivate Fire Drill" }));
    await waitFor(() => expect(mocks.setCustomItemActiveAction).toHaveBeenCalledWith("c-1", false));
  });

  it("brings an inactive item back", async () => {
    confirm.mockReturnValueOnce(true);
    mocks.setCustomItemActiveAction.mockResolvedValue({ ok: true });
    render(<CustomItemActions item={item({ is_active: false })} />);
    await userEvent.click(screen.getByRole("button", { name: "Reactivate Fire Drill" }));
    await waitFor(() => expect(mocks.setCustomItemActiveAction).toHaveBeenCalledWith("c-1", true));
  });
});
