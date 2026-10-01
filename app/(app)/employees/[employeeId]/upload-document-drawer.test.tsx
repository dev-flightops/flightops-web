import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.hoisted(() => vi.fn());
vi.mock("./document-actions", () => ({ uploadEmployeeDocumentAction: upload }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { UploadDocumentDrawer } from "./upload-document-drawer";

/**
 * A file over the upload limit is refused before it is sent: sent, it
 * would meet the platform's 413 and the page would show its error
 * boundary instead of this form's message.
 */

const requirements = [
  {
    id: "r-1",
    name: "Medical Certificate",
    description: null,
    applies_to_roles: [],
    required_on_hire: false,
    has_expiry: false,
    reminder_days: 30,
    sort_order: 100,
    is_active: true,
  },
];

function choose(size: number) {
  const file = new File(["x"], "medical scan.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.required = false;
}

describe("UploadDocumentDrawer", () => {
  beforeEach(() => {
    upload.mockReset();
    upload.mockResolvedValue({ ok: true });
  });

  it("says the real limit", () => {
    render(<UploadDocumentDrawer employeeId="u-1" requirements={requirements} />);
    fireEvent.click(screen.getByRole("button", { name: /upload/i }));
    expect(screen.getByText(/Max 3\.8 MB/)).toBeInTheDocument();
  });

  it("refuses a file over the limit without sending it", () => {
    render(<UploadDocumentDrawer employeeId="u-1" requirements={requirements} />);
    fireEvent.click(screen.getByRole("button", { name: /upload/i }));
    choose(9_000_000);
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "medical scan.pdf is 9.0 MB. Files over 3.8 MB can't be uploaded yet.",
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it("sends a file that fits", async () => {
    render(<UploadDocumentDrawer employeeId="u-1" requirements={requirements} />);
    fireEvent.click(screen.getByRole("button", { name: /upload/i }));
    choose(2_000_000);
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
