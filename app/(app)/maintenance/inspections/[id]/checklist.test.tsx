import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InspectionItem } from "@/lib/api/inspections";

const { passItemAction, failItemAction, removeItemAction, addItemAction } = vi.hoisted(() => ({
  passItemAction: vi.fn(async () => ({ ok: true as const })),
  failItemAction: vi.fn(async () => ({ ok: true as const })),
  removeItemAction: vi.fn(async () => ({ ok: true as const })),
  addItemAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("../actions", () => ({ passItemAction, failItemAction, removeItemAction, addItemAction }));

import { Checklist } from "./checklist";

function item(over: Partial<InspectionItem> = {}): InspectionItem {
  return {
    id: "it-1",
    section: "Landing gear",
    item_number: "2",
    description: "Main gear tyres",
    status: "pending",
    state: "pending",
    finding: null,
    squawk_id: null,
    squawk_status: null,
    squawk_severity: null,
    marked_by_name: null,
    marked_at: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Checklist (#178)", () => {
  it("groups the items by section, with their state", () => {
    render(
      <Checklist
        inspectionId="i-1"
        aircraftId="a-1"
        canEdit={false}
        items={[
          item(),
          item({ id: "it-2", section: "Flight controls", item_number: "1", description: "Cable tension", status: "pass", state: "pass" }),
          item({
            id: "it-3",
            description: "Brake pads",
            status: "fail",
            state: "corrected",
            finding: "Worn below limits",
            squawk_id: "sq-1",
            squawk_status: "resolved",
          }),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Landing gear" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Flight controls" })).toBeInTheDocument();
    const brakes = screen.getByRole("row", { name: /Brake pads/ });
    expect(within(brakes).getByText("Corrected")).toBeInTheDocument();
    expect(within(brakes).getByText("Found: Worn below limits")).toBeInTheDocument();
    expect(within(brakes).getByRole("link", { name: /Squawk · resolved/ })).toHaveAttribute(
      "href",
      "/maintenance/squawks?aircraft=a-1",
    );
    expect(screen.queryByRole("button", { name: /Pass:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Add a checklist item" })).not.toBeInTheDocument();
  });

  it("passes a pending item", async () => {
    render(<Checklist inspectionId="i-1" aircraftId="a-1" canEdit items={[item()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pass: Main gear tyres" }));
    await waitFor(() => expect(passItemAction).toHaveBeenCalledWith("i-1", "it-1"));
  });

  it("fails one with what was found, which opens the squawk", async () => {
    render(<Checklist inspectionId="i-1" aircraftId="a-1" canEdit items={[item()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Fail: Main gear tyres" }));
    fireEvent.change(screen.getByLabelText(/What was found/), { target: { value: "Worn to the cords" } });
    fireEvent.change(screen.getByLabelText("Squawk Severity"), { target: { value: "grounding" } });
    fireEvent.click(screen.getByRole("button", { name: "Fail & Open Squawk" }));
    await waitFor(() =>
      expect(failItemAction).toHaveBeenCalledWith("i-1", "it-1", { finding: "Worn to the cords", severity: "grounding" }),
    );
  });

  it("shows a refusal on the item", async () => {
    passItemAction.mockResolvedValueOnce({ ok: false, message: "That item is already checked." } as never);
    render(<Checklist inspectionId="i-1" aircraftId="a-1" canEdit items={[item()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pass: Main gear tyres" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That item is already checked.");
  });

  it("adds an item", async () => {
    render(<Checklist inspectionId="i-1" aircraftId="a-1" canEdit items={[]} />);
    expect(screen.getByText(/No checklist items yet/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "Engine" } });
    fireEvent.change(screen.getByLabelText("#"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Compression check" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(addItemAction).toHaveBeenCalledWith("i-1", { section: "Engine", item_number: "4", description: "Compression check" }),
    );
  });
});
