import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  useSearchParams: () => new URLSearchParams(""),
}));

const save = vi.fn(async (..._args: unknown[]) => ({ ok: true }) as { ok: boolean; error?: string });
vi.mock("@/app/(app)/dispatch/ack-actions", () => ({
  saveAcknowledgmentsAction: (...args: unknown[]) => save(...args),
}));

import {
  allSoftAcked,
  parseAckedWarns,
  SoftWarningAckList,
} from "./soft-warning-ack-list";
import type { ComplianceFinding } from "@/lib/api/types";

const grace: ComplianceFinding = {
  currency_item_id: "i-1",
  code: "ipc",
  name: "Instrument Proficiency Check",
  regulation: "14 CFR 135.297",
  status: "grace_month",
  last_completed_date: "2025-08-01",
  grace_month_end: "2026-07-31",
  message: "Grace ends 2026-07-31 — ack required.",
};

const medical: ComplianceFinding = {
  currency_item_id: "i-2",
  code: "medical_certificate",
  name: "Medical Certificate",
  regulation: "14 CFR 61.23",
  status: "due_this_month",
  last_completed_date: "2024-08-01",
  grace_month_end: null,
  message: "Medical expiring within 30 days — ack required.",
};

describe("parseAckedWarns", () => {
  it("returns empty set when the param is undefined or empty", () => {
    expect(parseAckedWarns(undefined).size).toBe(0);
    expect(parseAckedWarns("").size).toBe(0);
  });
  it("splits the comma-separated list, trims, and dedupes empties", () => {
    const set = parseAckedWarns("ipc, medical_certificate , ,ipc");
    expect(Array.from(set).sort()).toEqual(["ipc", "medical_certificate"]);
  });
  it("takes the first value when Next.js hands us an array", () => {
    const set = parseAckedWarns(["ipc,medical_certificate", "ignored"]);
    expect(set.has("ipc")).toBe(true);
    expect(set.has("medical_certificate")).toBe(true);
    expect(set.has("ignored")).toBe(false);
  });
});

describe("allSoftAcked", () => {
  it("returns true only when every finding's code is in the set", () => {
    expect(allSoftAcked([], new Set())).toBe(true);
    expect(allSoftAcked([grace, medical], new Set(["ipc"]))).toBe(false);
    expect(
      allSoftAcked([grace, medical], new Set(["ipc", "medical_certificate"])),
    ).toBe(true);
  });
});

describe("SoftWarningAckList (M2-G-5 tail; saved per dispatcher, #155)", () => {
  beforeEach(() => {
    save.mockReset();
    save.mockResolvedValue({ ok: true });
    refresh.mockReset();
  });

  it("renders a checkbox per finding, unchecked by default", () => {
    render(<SoftWarningAckList flightId="f-1" findings={[grace, medical]} ackedCodes={new Set()} />);
    expect(screen.getByLabelText("Acknowledge Instrument Proficiency Check")).not.toBeChecked();
    expect(screen.getByLabelText("Acknowledge Medical Certificate")).not.toBeChecked();
  });

  it("shows the Ack'd chip + line-through when the viewer's tick is saved", () => {
    render(
      <SoftWarningAckList flightId="f-1" findings={[grace, medical]} ackedCodes={new Set(["ipc"])} />,
    );
    expect(screen.getByLabelText("Acknowledge Instrument Proficiency Check")).toBeChecked();
    expect(screen.getByText("Ack'd")).toBeInTheDocument();
  });

  it("names whose box it is when either seat can hold the item", () => {
    render(
      <SoftWarningAckList
        flightId="f-1"
        seat="sic"
        findings={[medical, { ...grace, code: "sic_ifr_currency", name: "SIC IFR Currency" }]}
        ackedCodes={new Set()}
      />,
    );
    expect(screen.getByLabelText("Acknowledge Medical Certificate (SIC)")).toBeInTheDocument();
    expect(screen.getByLabelText("Acknowledge SIC IFR Currency")).toBeInTheDocument();
  });

  it("saves a tick for the dispatcher, with what was on screen, then refreshes; never the URL", async () => {
    const user = userEvent.setup();
    render(<SoftWarningAckList flightId="f-1" findings={[grace, medical]} ackedCodes={new Set()} />);
    await user.click(screen.getByLabelText("Acknowledge Instrument Proficiency Check"));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith("f-1", [
      {
        kind: "soft_warning",
        key: "ipc",
        on: true,
        detail: { name: "Instrument Proficiency Check", message: expect.any(String) },
      },
    ]);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("unticking withdraws it", async () => {
    const user = userEvent.setup();
    render(<SoftWarningAckList flightId="f-1" findings={[grace]} ackedCodes={new Set(["ipc"])} />);
    await user.click(screen.getByLabelText("Acknowledge Instrument Proficiency Check"));
    await vi.waitFor(() =>
      expect(save).toHaveBeenCalledWith("f-1", [
        expect.objectContaining({ kind: "soft_warning", key: "ipc", on: false }),
      ]),
    );
  });

  it("shows a tick at once, keeps the boxes open, and saves ticks in a row together (#145, #155)", async () => {
    const user = userEvent.setup();
    render(<SoftWarningAckList flightId="f-1" findings={[grace, medical]} ackedCodes={new Set()} />);
    const ipc = screen.getByLabelText("Acknowledge Instrument Proficiency Check");
    const med = screen.getByLabelText("Acknowledge Medical Certificate");
    await user.click(ipc);
    expect(ipc).toBeChecked();
    expect(med).toBeEnabled();
    await user.click(med);
    expect(med).toBeChecked();
    expect(save).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][1] as unknown[]).toHaveLength(2);
  });

  it("acknowledges every warning in one go", async () => {
    const user = userEvent.setup();
    render(<SoftWarningAckList flightId="f-1" findings={[grace, medical]} ackedCodes={new Set()} />);
    await user.click(screen.getByRole("button", { name: "Acknowledge all" }));
    expect(screen.getByLabelText("Acknowledge Instrument Proficiency Check")).toBeChecked();
    expect(screen.getByLabelText("Acknowledge Medical Certificate")).toBeChecked();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect((save.mock.calls[0][1] as { key: string }[]).map((c) => c.key).sort()).toEqual([
      "ipc",
      "medical_certificate",
    ]);
  });

  it("a tick that wasn't saved goes back, and says so", async () => {
    save.mockResolvedValue({ ok: false, error: "Only a dispatcher acknowledges for release." });
    const user = userEvent.setup();
    render(<SoftWarningAckList flightId="f-1" findings={[grace]} ackedCodes={new Set()} />);
    await user.click(screen.getByLabelText("Acknowledge Instrument Proficiency Check"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only a dispatcher");
    expect(screen.getByLabelText("Acknowledge Instrument Proficiency Check")).not.toBeChecked();
  });

  it("reads the box from what is saved once the server has the tick", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SoftWarningAckList flightId="f-1" findings={[grace, medical]} ackedCodes={new Set()} />,
    );
    await user.click(screen.getByLabelText("Acknowledge Instrument Proficiency Check"));
    rerender(
      <SoftWarningAckList flightId="f-1" findings={[grace, medical]} ackedCodes={new Set(["ipc"])} />,
    );
    expect(screen.getByLabelText("Acknowledge Instrument Proficiency Check")).toBeChecked();
    rerender(<SoftWarningAckList flightId="f-1" findings={[grace, medical]} ackedCodes={new Set()} />);
    expect(screen.getByLabelText("Acknowledge Instrument Proficiency Check")).not.toBeChecked();
  });
});
