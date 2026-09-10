import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const downloadT100CsvAction = vi.fn();
vi.mock("./actions", () => ({
  downloadT100CsvAction: (...a: unknown[]) => downloadT100CsvAction(...a),
}));

import { PeriodControls } from "./period-controls";

// jsdom implements neither, and the download path uses both. Stubbed
// rather than skipped so the filename can be asserted — it is what a
// folder of these gets sorted by.
const createObjectURL = vi.fn(() => "blob:t100");
const revokeObjectURL = vi.fn();
beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    writable: true,
    configurable: true,
  });
});

/**
 * Choosing the filing period, and getting the file.
 *
 * The month arithmetic is the part worth testing. Adding a month to a
 * Date is the classic trap — 31 January plus one month lands on 3
 * March — and no filing period skips February.
 */

beforeEach(() => {
  push.mockReset();
  downloadT100CsvAction.mockReset();
});

function controls(year = 2026, month = 9, hasRows = true) {
  render(<PeriodControls year={year} month={month} hasRows={hasRows} />);
}

describe("stepping the period", () => {
  it("shows the period being viewed", () => {
    controls();
    expect(screen.getByLabelText(/filing period/i)).toHaveValue("2026-09");
  });

  it("steps back a month", async () => {
    controls();
    await userEvent.setup().click(screen.getByRole("button", { name: /previous month/i }));
    expect(push).toHaveBeenCalledWith("/reports/regulatory/t100?year=2026&month=8");
  });

  it("steps forward a month", async () => {
    controls();
    await userEvent.setup().click(screen.getByRole("button", { name: /next month/i }));
    expect(push).toHaveBeenCalledWith("/reports/regulatory/t100?year=2026&month=10");
  });

  it("rolls December into the next January", async () => {
    controls(2026, 12);
    await userEvent.setup().click(screen.getByRole("button", { name: /next month/i }));
    expect(push).toHaveBeenCalledWith("/reports/regulatory/t100?year=2027&month=1");
  });

  it("rolls January back into the previous December", async () => {
    controls(2026, 1);
    await userEvent.setup().click(screen.getByRole("button", { name: /previous month/i }));
    expect(push).toHaveBeenCalledWith("/reports/regulatory/t100?year=2025&month=12");
  });

  it("never lands on a thirteenth month", async () => {
    // Zero-based arithmetic then back to 1-12. A naive month+1 gives
    // 13 here.
    controls(2026, 12);
    await userEvent.setup().click(screen.getByRole("button", { name: /next month/i }));
    const url = push.mock.calls[0][0] as string;
    const month = Number(new URL(url, "http://x").searchParams.get("month"));
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });

  it("goes to a period typed into the field", () => {
    controls();
    fireEvent.change(screen.getByLabelText(/filing period/i), {
      target: { value: "2026-02" },
    });
    expect(push).toHaveBeenCalledWith("/reports/regulatory/t100?year=2026&month=2");
  });

  it("ignores a cleared field", () => {
    controls();
    fireEvent.change(screen.getByLabelText(/filing period/i), {
      target: { value: "" },
    });
    expect(push).not.toHaveBeenCalled();
  });
});

describe("the export", () => {
  it("is offered when there is something to export", () => {
    controls();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeEnabled();
  });

  it("is disabled on an empty month", () => {
    // A button that downloads a header row and a zero total wastes
    // somebody's time and looks like a broken export.
    controls(2026, 9, false);
    expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
  });

  it("asks the server for the period on screen", async () => {
    downloadT100CsvAction.mockResolvedValue({ status: "ok", csv: "a,b\n1,2\n" });
    controls(2026, 3);
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    await waitFor(() =>
      expect(downloadT100CsvAction).toHaveBeenCalledWith(2026, 3),
    );
  });

  it("names the file by its period", async () => {
    // A folder of these is sorted by name, so nobody should have to
    // open one to find out which month it is.
    downloadT100CsvAction.mockResolvedValue({ status: "ok", csv: "a,b\n1,2\n" });
    const clicks: string[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this.getAttribute("download") ?? "");
    };
    try {
      controls(2026, 3);
      fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
      await waitFor(() => expect(clicks).toHaveLength(1));
      expect(clicks[0]).toBe("t100_2026-03.csv");
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it("releases the blob url it created", async () => {
    // Left unrevoked, each export leaks the file until the tab closes.
    downloadT100CsvAction.mockResolvedValue({ status: "ok", csv: "a,b\n1,2\n" });
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    try {
      controls();
      fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
      await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:t100"));
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it("shows why it failed rather than silently doing nothing", async () => {
    downloadT100CsvAction.mockResolvedValue({
      status: "error",
      message: "The export was refused (HTTP 403).",
    });
    controls();
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 403");
  });
});
