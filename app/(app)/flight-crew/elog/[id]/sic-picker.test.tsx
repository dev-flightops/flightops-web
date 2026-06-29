import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateSummaryAction } = vi.hoisted(() => ({
  updateSummaryAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./summary-actions", () => ({ updateSummaryAction }));

import { SicPicker } from "./sic-picker";
import type { UserRef } from "@/lib/api/types";

function pilot(id: string, full_name: string): UserRef {
  return { id, full_name, email: `${id}@x.test` };
}

beforeEach(() => {
  updateSummaryAction.mockReset();
});

describe("SicPicker", () => {
  it("lists candidates alphabetically with a 'No SIC' option first", () => {
    render(
      <SicPicker
        logId="log-1"
        initialSic={null}
        candidates={[
          pilot("u-1", "Charlie"),
          pilot("u-2", "Alice"),
          pilot("u-3", "Bob"),
        ]}
        selfUserId="u-self"
        readOnly={false}
      />,
    );
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "— No SIC (single-pilot flight)",
      "Alice",
      "Bob",
      "Charlie",
    ]);
  });

  it("excludes the caller from the candidate list", () => {
    render(
      <SicPicker
        logId="log-1"
        initialSic={null}
        candidates={[
          pilot("u-self", "Me Myself"),
          pilot("u-other", "Other Pilot"),
        ]}
        selfUserId="u-self"
        readOnly={false}
      />,
    );
    expect(screen.queryByText("Me Myself")).toBeNull();
    expect(screen.getByText("Other Pilot")).toBeInTheDocument();
  });

  it("pre-selects the current SIC", () => {
    render(
      <SicPicker
        logId="log-1"
        initialSic={pilot("u-2", "Alice")}
        candidates={[pilot("u-2", "Alice"), pilot("u-3", "Bob")]}
        selfUserId="u-self"
        readOnly={false}
      />,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("u-2");
  });

  it("PATCHes the new SIC user_id on change", () => {
    updateSummaryAction.mockResolvedValueOnce({ status: "ok" });
    render(
      <SicPicker
        logId="log-1"
        initialSic={null}
        candidates={[pilot("u-2", "Alice")]}
        selfUserId="u-self"
        readOnly={false}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "u-2" },
    });
    expect(updateSummaryAction).toHaveBeenCalledWith("log-1", {
      sic_user_id: "u-2",
    });
  });

  it("PATCHes null when 'No SIC' is selected", () => {
    updateSummaryAction.mockResolvedValueOnce({ status: "ok" });
    render(
      <SicPicker
        logId="log-1"
        initialSic={pilot("u-2", "Alice")}
        candidates={[pilot("u-2", "Alice")]}
        selfUserId="u-self"
        readOnly={false}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(updateSummaryAction).toHaveBeenCalledWith("log-1", {
      sic_user_id: null,
    });
  });

  it("disables the select in submitted (readOnly) mode", () => {
    render(
      <SicPicker
        logId="log-1"
        initialSic={null}
        candidates={[pilot("u-2", "Alice")]}
        selfUserId="u-self"
        readOnly={true}
      />,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("rolls back to the original value when the action errors", async () => {
    updateSummaryAction.mockResolvedValueOnce({
      status: "error",
      message: "Server said no.",
    });
    render(
      <SicPicker
        logId="log-1"
        initialSic={pilot("u-2", "Alice")}
        candidates={[pilot("u-2", "Alice"), pilot("u-3", "Bob")]}
        selfUserId="u-self"
        readOnly={false}
      />,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "u-3" } });
    // Allow the transition's await to flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(select.value).toBe("u-2");
    expect(screen.getByRole("alert")).toHaveTextContent("Server said no.");
  });
});
