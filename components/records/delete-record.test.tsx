import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { DeleteRecord } from "./delete-record";

function setup(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
  render(
    <DeleteRecord
      label="Delete flight"
      title="Delete TCL1?"
      description="For a flight made as a test."
      action={action}
      redirectTo="/flight-following"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete flight" }));
}

describe("DeleteRecord (1119-30)", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("asks first, then deletes and leaves for the list", async () => {
    const action = vi.fn(async () => ({ ok: true as const }));
    setup(action);
    expect(screen.getByRole("dialog", { name: "Delete TCL1?" })).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete flight" }).at(-1)!);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/flight-following"));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows why the server kept it, and stays", async () => {
    setup(async () => ({ ok: false, message: "It departed, so it stays on record." }));

    fireEvent.click(screen.getAllByRole("button", { name: "Delete flight" }).at(-1)!);

    expect(await screen.findByRole("alert")).toHaveTextContent("It departed, so it stays on record.");
    expect(push).not.toHaveBeenCalled();
  });

  it("Keep it closes without deleting", async () => {
    const action = vi.fn(async () => ({ ok: true as const }));
    setup(action);

    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(action).not.toHaveBeenCalled();
  });
});
