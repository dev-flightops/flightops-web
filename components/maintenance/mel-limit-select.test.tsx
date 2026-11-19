import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setMelLimitAction, refresh } = vi.hoisted(() => ({
  setMelLimitAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/maintenance-actions", () => ({ setMelLimitAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { MelLimitSelect } from "./mel-limit-select";

beforeEach(() => vi.clearAllMocks());

/** #200: the client's nav light had "day VFR only" in its description. */
describe("an open deferral's limit, changed in place", () => {
  it("saves the limit chosen, and none as null", async () => {
    const user = userEvent.setup();
    setMelLimitAction.mockResolvedValue({ ok: true });
    render(<MelLimitSelect melItemId="mel-1" ataChapter="33-40" limit={null} />);
    const select = screen.getByLabelText("Limit for MEL 33-40");
    await user.selectOptions(select, "Day VFR only");
    await waitFor(() => expect(setMelLimitAction).toHaveBeenCalledWith("mel-1", "day_vfr"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await user.selectOptions(select, "None");
    await waitFor(() => expect(setMelLimitAction).toHaveBeenLastCalledWith("mel-1", null));
  });

  it("goes back to what it was when the save is refused, saying why", async () => {
    const user = userEvent.setup();
    setMelLimitAction.mockResolvedValue({ ok: false, error: "Only maintenance (the DOM or a mechanic) can change an MEL item." });
    render(<MelLimitSelect melItemId="mel-1" ataChapter="33-40" limit="vfr" />);
    const select = screen.getByLabelText("Limit for MEL 33-40");
    await user.selectOptions(select, "Day VFR only");
    expect(await screen.findByRole("alert")).toHaveTextContent("Only maintenance");
    expect(select).toHaveValue("vfr");
    expect(refresh).not.toHaveBeenCalled();
  });
});
