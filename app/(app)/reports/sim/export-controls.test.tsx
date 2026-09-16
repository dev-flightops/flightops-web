import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// jsdom implements neither, and the download path uses both. Stubbed
// rather than skipped so the anchor's filename can be asserted — the
// name is built here and again in reports-service, and this is the
// only place the web half of that pair is observable.
const createObjectURL = vi.fn(() => "blob:sim");
const revokeObjectURL = vi.fn();
beforeEach(() => {
  push.mockReset();
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

import type { SimBasis, SimFormat } from "@/lib/api/reports";

import { ExportControls, type FileResult } from "./export-controls";

/**
 * The export controls.
 *
 * The cases worth pinning are the two refusals: a combination the
 * service will reject, made visible before the click rather than
 * after it; and an empty window, where the button is disabled rather
 * than handing over a file with a header row and nothing under it.
 */

const ok: FileResult = { status: "ok", body: "a,b\n1,2\n", filename: "x.csv" };

function controls(
  over: {
    basis?: SimBasis;
    records?: number;
    downloadAction?: (
      carrier: string,
      s: string,
      e: string,
      b: SimBasis,
      f: SimFormat,
    ) => Promise<FileResult>;
  } = {},
) {
  const action = over.downloadAction ?? vi.fn(async () => ok);
  render(
    <ExportControls
      carrier="PG"
      start="2026-09-01"
      end="2026-09-08"
      basis={over.basis ?? "schedule"}
      records={over.records ?? 4}
      downloadAction={action}
    />,
  );
  return action;
}

describe("the window", () => {
  it("bounds each date by the other so the range cannot be inverted", () => {
    // The service refuses a backwards window rather than swapping it.
    // Letting the form produce one means a 422 the user has to read.
    controls();
    expect(screen.getByLabelText("Window start")).toHaveAttribute(
      "max",
      "2026-09-08",
    );
    expect(screen.getByLabelText("Window end")).toHaveAttribute(
      "min",
      "2026-09-01",
    );
  });
});

describe("the combination the service refuses", () => {
  it("disables fixed-width on the flights basis", () => {
    // The fixed-width record ends at seats: no passenger, cargo or
    // mail columns. Legacy offers it anyway and drops all three.
    controls({ basis: "flights" });
    const fixed = screen.getByRole("option", {
      name: /Fixed-width SIM/,
    }) as HTMLOptionElement;
    expect(fixed.disabled).toBe(true);
  });

  it("says why, rather than only greying it out", () => {
    controls({ basis: "flights" });
    expect(
      screen.getByText(/no passenger,\s+cargo or mail fields/),
    ).toBeInTheDocument();
  });

  it("leaves it available on the schedule basis", () => {
    controls({ basis: "schedule" });
    const fixed = screen.getByRole("option", {
      name: "Fixed-width SIM",
    }) as HTMLOptionElement;
    expect(fixed.disabled).toBe(false);
    expect(screen.queryByText(/no passenger/)).not.toBeInTheDocument();
  });
});

describe("an empty window", () => {
  it("disables the download rather than producing a header-only file", () => {
    controls({ records: 0 });
    expect(
      screen.getByRole("button", { name: /Download/ }),
    ).toBeDisabled();
  });

  it("says why on hover", () => {
    controls({ records: 0 });
    expect(screen.getByRole("button", { name: /Download/ })).toHaveAttribute(
      "title",
      "Nothing to export in this window",
    );
  });
});

describe("downloading", () => {
  it("passes the window, basis and chosen format to the action", async () => {
    const action = vi.fn(async () => ok);
    controls({ downloadAction: action });
    await userEvent.selectOptions(
      screen.getByLabelText("File format"),
      "xml",
    );
    await userEvent.click(screen.getByRole("button", { name: /Download/ }));
    // The carrier goes first and comes from the prop, not from inside
    // the action — a server component cannot pass a closure that binds
    // it, which is how this page first broke.
    expect(action).toHaveBeenCalledWith(
      "PG",
      "2026-09-01",
      "2026-09-08",
      "schedule",
      "xml",
    );
  });

  it("surfaces a refusal instead of failing silently", async () => {
    const action = vi.fn(
      async (): Promise<FileResult> => ({
        status: "error",
        message: "No carrier code is set for this operator.",
      }),
    );
    controls({ downloadAction: action });
    await userEvent.click(screen.getByRole("button", { name: /Download/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No carrier code is set",
    );
  });

  it("saves under the filename the action returned", async () => {
    // Not one the button invented. The action builds it from the
    // carrier the report came back with, so a tenant's own designator
    // reaches the saved file.
    const action = vi.fn(
      async (): Promise<FileResult> => ({
        status: "ok",
        body: "a,b\n",
        filename: "ABX_schedule_2026-09-01_2026-09-08.csv",
      }),
    );
    const anchors: HTMLAnchorElement[] = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = create(tag);
      if (tag === "a") anchors.push(el as HTMLAnchorElement);
      return el;
    });

    controls({ downloadAction: action });
    await userEvent.click(screen.getByRole("button", { name: /Download/ }));

    expect(anchors.at(-1)?.download).toBe(
      "ABX_schedule_2026-09-01_2026-09-08.csv",
    );
    vi.mocked(document.createElement).mockRestore();
  });

  it("releases the blob so an export does not hold the file until the tab closes", async () => {
    controls();
    await userEvent.click(screen.getByRole("button", { name: /Download/ }));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:sim");
  });

  it("names the format on the button so the click is unambiguous", async () => {
    controls();
    expect(
      screen.getByRole("button", { name: "Download CSV" }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("File format"),
      "fixed",
    );
    expect(
      screen.getByRole("button", { name: "Download Fixed-width SIM" }),
    ).toBeInTheDocument();
  });
});
