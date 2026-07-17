import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(""),
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

describe("SoftWarningAckList (M2-G-5 tail)", () => {
  it("renders a checkbox per finding, unchecked by default", () => {
    render(
      <SoftWarningAckList findings={[grace, medical]} ackedCodes={new Set()} />,
    );
    const ipc = screen.getByLabelText(
      "Acknowledge Instrument Proficiency Check",
    ) as HTMLInputElement;
    const med = screen.getByLabelText(
      "Acknowledge Medical Certificate",
    ) as HTMLInputElement;
    expect(ipc).not.toBeChecked();
    expect(med).not.toBeChecked();
  });

  it("shows the Ack'd chip + line-through when a code is already acked", () => {
    render(
      <SoftWarningAckList
        findings={[grace, medical]}
        ackedCodes={new Set(["ipc"])}
      />,
    );
    const ipc = screen.getByLabelText(
      "Acknowledge Instrument Proficiency Check",
    ) as HTMLInputElement;
    expect(ipc).toBeChecked();
    expect(screen.getByText("Ack'd")).toBeInTheDocument();
  });

  it("pushes ?warns_acked=<code> when a checkbox flips on", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(
      <SoftWarningAckList findings={[grace, medical]} ackedCodes={new Set()} />,
    );
    await user.click(
      screen.getByLabelText("Acknowledge Instrument Proficiency Check"),
    );
    expect(push).toHaveBeenCalledWith("/dispatch/?warns_acked=ipc");
  });

  it("pushes clean URL when the last ack toggles off", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(
      <SoftWarningAckList
        findings={[grace]}
        ackedCodes={new Set(["ipc"])}
      />,
    );
    await user.click(
      screen.getByLabelText("Acknowledge Instrument Proficiency Check"),
    );
    expect(push).toHaveBeenCalledWith("/dispatch/");
  });
});
