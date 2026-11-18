import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { BagDraft } from "@/lib/bags";

import { BagsEditor } from "./bags-editor";

function Harness({ initial = null, name }: { initial?: BagDraft[] | null; name?: string }) {
  const [bags, setBags] = useState<BagDraft[] | null>(initial);
  return (
    <form aria-label="Check in">
      <BagsEditor value={bags} onChange={setBags} required name={name} />
    </form>
  );
}

const posted = () => {
  const form = screen.getByRole("form", { name: "Check in" }) as HTMLFormElement;
  const raw = new FormData(form).get("bags");
  return raw === null ? null : JSON.parse(String(raw));
};

describe("BagsEditor (the client, 18 Nov)", () => {
  it("weighs each bag, carry-on or checked, with what it looks like", () => {
    render(<Harness name="bags" />);
    // Not answered yet: nothing goes with the form.
    expect(posted()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add bag" }));
    fireEvent.click(screen.getByRole("button", { name: "Add bag" }));
    const first = screen.getByRole("group", { name: "Bag 1" });
    fireEvent.change(within(first).getByLabelText("Weight (lb)"), { target: { value: "40" } });
    fireEvent.change(within(first).getByLabelText("Description"), { target: { value: "Black duffel, red tag" } });
    const second = screen.getByRole("group", { name: "Bag 2" });
    fireEvent.change(within(second).getByLabelText("Weight (lb)"), { target: { value: "12.5" } });
    fireEvent.click(within(second).getByRole("checkbox", { name: "Carry-on" }));

    expect(screen.getByText("2 bags, 52.5 lb (1 carry-on, 12.5 lb)")).toBeInTheDocument();
    expect(posted()).toEqual([
      { weight_lbs: 40, carry_on: false, description: "Black duffel, red tag" },
      { weight_lbs: 12.5, carry_on: true, description: null },
    ]);
  });

  it("answers no bags, by ticking it or by taking the last one off", () => {
    render(<Harness name="bags" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "No bags" }));
    expect(posted()).toEqual([]);
    fireEvent.click(screen.getByRole("checkbox", { name: "No bags" }));
    expect(posted()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add bag" }));
    expect(screen.queryByRole("checkbox", { name: "No bags" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove bag 1" }));
    expect(screen.getByRole("checkbox", { name: "No bags" })).toBeChecked();
    expect(posted()).toEqual([]);
  });

  it("asks for each bag's weight", () => {
    render(<Harness initial={[{ key: "b-1", weight: "", carryOn: false, description: "" }]} />);
    const weight = within(screen.getByRole("group", { name: "Bag 1" })).getByLabelText("Weight (lb)");
    expect(weight).toBeRequired();
    expect(weight).toHaveAttribute("max", "2000");
    expect(within(screen.getByRole("group", { name: "Bag 1" })).getByLabelText("Description")).toHaveAttribute(
      "maxLength",
      "200",
    );
  });
});
