import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// The download action arrives as a prop, not an import — it is a
// server action and `apiFetch` begins with `await auth()`. So there is
// nothing to mock out of a module here; the test supplies it.
const downloadAction = vi.fn();

import {
  MonthlyFilingControls,
  QuarterlyFilingControls,
} from "./filing-controls";

// jsdom implements neither, and the download path uses both. Stubbed
// rather than skipped so the filename can be asserted — it is what a
// folder of these gets sorted by.
const createObjectURL = vi.fn(() => "blob:filing");
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
  downloadAction.mockReset();
});

function controls(year = 2026, month = 9, hasRows = true) {
  render(
    <MonthlyFilingControls
      basePath="/reports/regulatory/t100"
      filePrefix="t100"
      year={year}
      month={month}
      hasRows={hasRows}
      downloadAction={downloadAction}
    />,
  );
}

function quarterly(year = 2026, quarter = 3, hasRows = true) {
  render(
    <QuarterlyFilingControls
      basePath="/reports/regulatory/dot41"
      filePrefix="dot41"
      year={year}
      quarter={quarter}
      hasRows={hasRows}
      downloadAction={downloadAction}
    />,
  );
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
    downloadAction.mockResolvedValue({ status: "ok", csv: "a,b\n1,2\n" });
    controls(2026, 3);
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    await waitFor(() =>
      expect(downloadAction).toHaveBeenCalledWith(2026, 3),
    );
  });

  it("names the file by its period", async () => {
    // A folder of these is sorted by name, so nobody should have to
    // open one to find out which month it is.
    downloadAction.mockResolvedValue({ status: "ok", csv: "a,b\n1,2\n" });
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
    downloadAction.mockResolvedValue({ status: "ok", csv: "a,b\n1,2\n" });
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    try {
      controls();
      fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
      await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:filing"));
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it("shows why it failed rather than silently doing nothing", async () => {
    downloadAction.mockResolvedValue({
      status: "error",
      message: "The export was refused (HTTP 403).",
    });
    controls();
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 403");
  });
});

describe("stepping a quarterly period", () => {
  it("shows the quarter being viewed", () => {
    quarterly();
    expect(screen.getByLabelText(/filing period/i)).toHaveValue("2026-Q3");
  });

  it("steps back a quarter", async () => {
    quarterly();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /previous quarter/i }));
    expect(push).toHaveBeenCalledWith(
      "/reports/regulatory/dot41?year=2026&quarter=2",
    );
  });

  it("rolls Q4 into the next Q1", async () => {
    quarterly(2026, 4);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /next quarter/i }));
    expect(push).toHaveBeenCalledWith(
      "/reports/regulatory/dot41?year=2027&quarter=1",
    );
  });

  it("rolls Q1 back into the previous Q4", async () => {
    quarterly(2026, 1);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /previous quarter/i }));
    expect(push).toHaveBeenCalledWith(
      "/reports/regulatory/dot41?year=2025&quarter=4",
    );
  });

  it("never lands on a fifth quarter", async () => {
    quarterly(2026, 4);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /next quarter/i }));
    const url = push.mock.calls[0][0] as string;
    const q = Number(new URL(url, "http://x").searchParams.get("quarter"));
    expect(q).toBeGreaterThanOrEqual(1);
    expect(q).toBeLessThanOrEqual(4);
  });

  it("offers the quarters either side without a year picker", () => {
    quarterly(2026, 1);
    // Four back from Q1 2026 reaches Q1 2025, four forward reaches Q1
    // 2027 — so a year-old filing is reachable in one click.
    expect(
      screen.getByRole("option", { name: "Q1 2025" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Q1 2027" }),
    ).toBeInTheDocument();
  });

  it("names the quarterly file Qn, not a padded month", async () => {
    // "dot41_2026-03.csv" for Q3 reads as March.
    downloadAction.mockResolvedValue({ status: "ok", csv: "a,b\n1,2\n" });
    const clicks: string[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this.getAttribute("download") ?? "");
    };
    try {
      quarterly(2026, 3);
      fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
      await waitFor(() => expect(clicks).toHaveLength(1));
      expect(clicks[0]).toBe("dot41_2026-Q3.csv");
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });
});
