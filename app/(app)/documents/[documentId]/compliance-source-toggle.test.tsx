import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The compliance-source toggle.
 *
 * What is worth pinning: it sends the value the operator picked, and
 * it does not leave the box showing a state the server refused. An
 * optimistic checkbox that never reconciles is how somebody comes to
 * believe the GOM is designated when the PATCH 403'd.
 */

const { updateDocumentAction, refresh } = vi.hoisted(() => ({
  updateDocumentAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../actions", () => ({ updateDocumentAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ComplianceSourceToggle } from "./compliance-source-toggle";

const box = () => screen.getByRole("checkbox", { name: /Compliance source/i });

beforeEach(() => {
  updateDocumentAction.mockReset();
  refresh.mockReset();
  updateDocumentAction.mockResolvedValue({ ok: true });
});

describe("designating a document", () => {
  it("sends the flag for the document it was given", async () => {
    render(<ComplianceSourceToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(updateDocumentAction).toHaveBeenCalledWith("d-7", {
      is_compliance_source: true,
    });
  });

  it("shows the new state", async () => {
    render(<ComplianceSourceToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(box()).toBeChecked();
  });

  it("refreshes so the library badge and filter agree with it", async () => {
    render(<ComplianceSourceToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(refresh).toHaveBeenCalled();
  });
});

describe("removing the designation", () => {
  it("sends false rather than omitting the field", async () => {
    // Sending nothing would leave the document designated — the
    // backend treats an absent field as "don't touch".
    render(<ComplianceSourceToggle documentId="d-7" initialValue={true} />);
    await userEvent.click(box());
    expect(updateDocumentAction).toHaveBeenCalledWith("d-7", {
      is_compliance_source: false,
    });
    expect(box()).not.toBeChecked();
  });
});

describe("when the server refuses", () => {
  it("snaps the box back instead of showing a state that was rejected", async () => {
    updateDocumentAction.mockResolvedValue({
      ok: false,
      error: "Not allowed.",
    });
    render(<ComplianceSourceToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(box()).not.toBeChecked();
  });

  it("says why", async () => {
    updateDocumentAction.mockResolvedValue({
      ok: false,
      error: "You don't have permission to edit documents.",
    });
    render(<ComplianceSourceToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You don't have permission to edit documents.",
    );
  });

  it("falls back to a message when the action gives no reason", async () => {
    updateDocumentAction.mockResolvedValue({ ok: false });
    render(<ComplianceSourceToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Couldn't update this document/i,
    );
  });

  it("does not refresh a page whose data did not change", async () => {
    updateDocumentAction.mockResolvedValue({ ok: false, error: "nope" });
    render(<ComplianceSourceToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("clears a stale error once a later toggle succeeds", async () => {
    updateDocumentAction.mockResolvedValueOnce({ ok: false, error: "nope" });
    render(<ComplianceSourceToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(screen.getByRole("alert")).toBeInTheDocument();

    updateDocumentAction.mockResolvedValueOnce({ ok: true });
    await userEvent.click(box());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(box()).toBeChecked();
  });
});
