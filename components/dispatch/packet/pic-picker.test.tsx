import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { PicPicker, type PicOption } from "./pic-picker";

const sarah: PicOption = {
  pilot: {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    full_name: "Sarah Kessler",
    email: "sarah@x",
  },
  status: "early_month",
};
const bob: PicOption = {
  pilot: {
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    full_name: "Bob Henderson",
    email: "bob@x",
  },
  status: "grace_month",
};
const alice: PicOption = {
  pilot: {
    id: "aaaaaaaa-0000-0000-0000-000000000003",
    full_name: "Alice Chen",
    email: "alice@x",
  },
  status: "non_current",
};

describe("PicPicker (M2-G-5)", () => {
  it("renders one option per pilot with the status label appended", () => {
    render(
      <PicPicker options={[sarah, bob, alice]} currentPicId={null} />,
    );
    const combo = screen.getByLabelText("Pilot in Command") as HTMLSelectElement;
    expect(combo).toBeInTheDocument();
    // 3 pilots + the "select a pilot" placeholder
    expect(combo.options).toHaveLength(4);
    // Status shows in the option text.
    expect(combo.textContent).toMatch(/Sarah Kessler.*Fully current/);
    expect(combo.textContent).toMatch(/Bob Henderson.*Grace month/);
    expect(combo.textContent).toMatch(/Alice Chen.*NON-CURRENT/);
  });

  it("renders the red status dot next to the label when the selected PIC is non-current", () => {
    render(
      <PicPicker
        options={[sarah, bob, alice]}
        currentPicId={alice.pilot.id}
      />,
    );
    const dot = screen.getByLabelText(/PIC compliance red/i);
    expect(dot).toBeInTheDocument();
  });

  it("navigates to /dispatch/?pic=<uuid> when a pilot is chosen", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(
      <PicPicker options={[sarah, bob, alice]} currentPicId={null} />,
    );
    await user.selectOptions(
      screen.getByLabelText("Pilot in Command"),
      alice.pilot.id,
    );
    expect(push).toHaveBeenCalledWith(`/dispatch/?pic=${alice.pilot.id}`);
  });

  it("clears the pic param when the placeholder option is chosen", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(
      <PicPicker
        options={[sarah, bob, alice]}
        currentPicId={alice.pilot.id}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText("Pilot in Command"),
      "",
    );
    expect(push).toHaveBeenCalledWith("/dispatch/");
  });

  it("disables and shows an empty-roster label when no pilots exist", () => {
    render(<PicPicker options={[]} currentPicId={null} />);
    const combo = screen.getByLabelText(
      "Pilot in Command",
    ) as HTMLSelectElement;
    expect(combo).toBeDisabled();
    expect(combo.textContent).toMatch(/No pilots on roster/);
  });
});
