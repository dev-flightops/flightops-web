import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LimitReading } from "@/lib/api/document-limits";

const {
  readDocumentLimitsAction,
  getReadingAction,
  approveLimitAction,
  rejectLimitAction,
  refresh,
} = vi.hoisted(() => ({
  readDocumentLimitsAction: vi.fn(),
  getReadingAction: vi.fn(),
  approveLimitAction: vi.fn(),
  rejectLimitAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./document-limits-actions", () => ({
  readDocumentLimitsAction,
  getReadingAction,
  approveLimitAction,
  rejectLimitAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DocumentLimitsSection } from "./document-limits-section";

const GOM = { id: "d-gom", title: "General Operations Manual", version: 3 };
const CURRENT = {
  crosswind_single_engine_kt: 30,
  crosswind_multi_engine_kt: 40,
  crosswind_near_margin_kt: 10,
  vfr_min_ceiling_ft: 1000,
  vfr_min_visibility_sm: 3,
};

function reading(over: Partial<LimitReading> = {}): LimitReading {
  return {
    id: "r-1",
    document_id: GOM.id,
    document_title: GOM.title,
    version_number: 3,
    status: "done",
    model: "claude-sonnet-5",
    pages_read: 2,
    proposals_found: 2,
    proposals_dropped: 1,
    error: null,
    requested_by_name: "Casey Chief",
    started_at: "2026-10-06T09:00:00Z",
    finished_at: "2026-10-06T09:00:30Z",
    proposals: [
      {
        id: "p-1",
        limit_key: "crosswind_single_engine_kt",
        label: "Crosswind limit, single-engine aircraft",
        value: "30.00",
        unit: "kt",
        applies_to: "single-engine aircraft",
        page_number: 3,
        quote: "The company crosswind limit is 30 knots for single-engine aircraft",
        status: "pending",
        created_at: "2026-10-06T09:00:30Z",
      },
      {
        id: "p-2",
        limit_key: "crosswind_multi_engine_kt",
        label: "Crosswind limit, multi-engine aircraft",
        value: "35.00",
        unit: "kt",
        applies_to: null,
        page_number: 3,
        quote: "35 knots for multi-engine aircraft",
        status: "pending",
        created_at: "2026-10-06T09:00:30Z",
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("DocumentLimitsSection", () => {
  it("says where to start when no document is a compliance source", () => {
    render(<DocumentLimitsSection documents={[]} latest={{}} current={CURRENT} />);
    expect(screen.getByText(/No document is marked as a compliance source yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Document Library" })).toHaveAttribute(
      "href",
      "/documents",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows each proposal beside the value set now, with its page and sentence", () => {
    render(
      <DocumentLimitsSection
        documents={[GOM]}
        latest={{ [GOM.id]: reading() }}
        current={CURRENT}
      />,
    );
    expect(
      screen.getByText(/Version 3, read on 2026-10-06 \(asked by Casey Chief\): 2 limits found on 2 pages/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 more set aside/)).toBeInTheDocument();

    const single = screen.getByText("Crosswind limit, single-engine aircraft").closest("tr")!;
    expect(within(single).getAllByText("30 kt")).toHaveLength(2);
    expect(within(single).getByText("same")).toBeInTheDocument();
    expect(within(single).getByText("Page 3")).toBeInTheDocument();
    expect(single).toHaveTextContent(
      "The company crosswind limit is 30 knots for single-engine aircraft",
    );

    // "single-engine aircraft" adds nothing to the name, so it isn't repeated.
    expect(within(single).queryByText("single-engine aircraft")).toBeNull();

    const multi = screen.getByText("Crosswind limit, multi-engine aircraft").closest("tr")!;
    expect(within(multi).getByText("35 kt")).toBeInTheDocument();
    expect(within(multi).getByText("40 kt")).toBeInTheDocument();
    expect(within(multi).getByText("differs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read again" })).toBeInTheDocument();
  });

  it("starts a reading and asks after it until it's done", async () => {
    vi.useFakeTimers();
    readDocumentLimitsAction.mockResolvedValue({
      ok: true,
      reading: reading({ status: "running", proposals: [], finished_at: null }),
    });
    getReadingAction.mockResolvedValue({ ok: true, reading: reading() });
    render(<DocumentLimitsSection documents={[GOM]} latest={{ [GOM.id]: null }} current={CURRENT} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Read limits" }));
    });
    expect(readDocumentLimitsAction).toHaveBeenCalledWith(GOM.id);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reading General Operations Manual version 3. This takes up to a minute.",
    );
    expect(screen.getByRole("button", { name: "Reading…" })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(getReadingAction).toHaveBeenCalledWith("r-1");
    expect(screen.getByText("Crosswind limit, single-engine aircraft")).toBeInTheDocument();
  });

  it("says when a reading failed", () => {
    render(
      <DocumentLimitsSection
        documents={[GOM]}
        latest={{ [GOM.id]: reading({ status: "failed", error: "anthropic_timeout", proposals: [] }) }}
        current={CURRENT}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The last reading failed: the reader took too long. Read it again.",
    );
  });

  it("shows why a reading couldn't start", async () => {
    readDocumentLimitsAction.mockResolvedValue({
      ok: false,
      error: "Only a PDF or a text file can be read for limits.",
    });
    render(<DocumentLimitsSection documents={[GOM]} latest={{}} current={CURRENT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Read limits" }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only a PDF or a text file can be read for limits.",
    );
  });

  it("approves a proposal as read and refreshes the page", async () => {
    approveLimitAction.mockResolvedValue({ ok: true });
    render(
      <DocumentLimitsSection documents={[GOM]} latest={{ [GOM.id]: reading() }} current={CURRENT} />,
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Approve Crosswind limit, multi-engine aircraft: 35 kt" }),
      );
    });
    expect(approveLimitAction).toHaveBeenCalledWith("p-2");
    expect(refresh).toHaveBeenCalled();
  });

  it("approves a corrected value instead", async () => {
    approveLimitAction.mockResolvedValue({ ok: true });
    render(
      <DocumentLimitsSection documents={[GOM]} latest={{ [GOM.id]: reading() }} current={CURRENT} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Change Crosswind limit, multi-engine aircraft before approving" }),
    );
    const input = screen.getByRole("spinbutton", {
      name: "Value to approve for Crosswind limit, multi-engine aircraft",
    });
    expect(input).toHaveValue(35);
    fireEvent.change(input, { target: { value: "33" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve 33" }));
    });
    expect(approveLimitAction).toHaveBeenCalledWith("p-2", "33");
  });

  it("rejects, and shows a refusal where it happened", async () => {
    rejectLimitAction.mockResolvedValue({
      ok: false,
      error: "Someone has already decided on this one. Refresh the page.",
    });
    render(
      <DocumentLimitsSection documents={[GOM]} latest={{ [GOM.id]: reading() }} current={CURRENT} />,
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Reject Crosswind limit, single-engine aircraft" }),
      );
    });
    expect(rejectLimitAction).toHaveBeenCalledWith("p-1");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Someone has already decided on this one.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says what became of a proposal once decided", () => {
    const decided = reading({
      proposals: [
        {
          ...reading().proposals[0],
          status: "approved",
          reviewed_by_name: "Casey Chief",
          approved_value: "28.00",
        },
        { ...reading().proposals[1], status: "rejected", reviewed_by_name: "Casey Chief" },
      ],
    });
    render(
      <DocumentLimitsSection documents={[GOM]} latest={{ [GOM.id]: decided }} current={CURRENT} />,
    );
    expect(screen.getByText("Approved by Casey Chief")).toBeInTheDocument();
    expect(screen.getByText("28 kt applied")).toBeInTheDocument();
    expect(screen.getByText("Rejected by Casey Chief")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve/ })).toBeNull();
  });

  it("shows a dropped request as a message, not the error screen", async () => {
    readDocumentLimitsAction.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<DocumentLimitsSection documents={[GOM]} latest={{}} current={CURRENT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Read limits" }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server.");
  });
});
