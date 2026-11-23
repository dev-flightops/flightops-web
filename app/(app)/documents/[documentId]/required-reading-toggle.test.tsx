import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The required-reading toggle: nothing in the app could set the flag, so
 * a new bulletin could never be made required reading.
 */

const { updateDocumentAction, refresh } = vi.hoisted(() => ({
  updateDocumentAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../actions", () => ({ updateDocumentAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RequiredReadingToggle } from "./required-reading-toggle";

const box = () => screen.getByRole("checkbox", { name: /Required reading/i });

beforeEach(() => {
  updateDocumentAction.mockReset();
  refresh.mockReset();
  updateDocumentAction.mockResolvedValue({ ok: true });
});

describe("making a document required reading", () => {
  it("sends the flag for the document it was given, and refreshes", async () => {
    render(<RequiredReadingToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(updateDocumentAction).toHaveBeenCalledWith("d-7", { requires_acknowledgment: true });
    expect(box()).toBeChecked();
    expect(refresh).toHaveBeenCalled();
  });

  it("sends false to take it off, rather than omitting the field", async () => {
    render(<RequiredReadingToggle documentId="d-7" initialValue={true} />);
    await userEvent.click(box());
    expect(updateDocumentAction).toHaveBeenCalledWith("d-7", { requires_acknowledgment: false });
    expect(box()).not.toBeChecked();
  });
});

describe("when the server refuses", () => {
  it("snaps the box back and says why", async () => {
    updateDocumentAction.mockResolvedValue({ ok: false, error: "Not allowed." });
    render(<RequiredReadingToggle documentId="d-7" initialValue={false} />);
    await userEvent.click(box());
    expect(box()).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("Not allowed.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
