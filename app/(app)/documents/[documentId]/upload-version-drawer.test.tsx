import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadLargeVersion, refresh } = vi.hoisted(() => ({ uploadLargeVersion: vi.fn(), refresh: vi.fn() }));
vi.mock("../actions", () => ({ uploadVersionAction: vi.fn() }));
vi.mock("../large-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../large-upload")>()),
  uploadLargeVersion,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
// Next runs the form on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import { UploadVersionDrawer } from "./upload-version-drawer";

const BIG = new File([new Uint8Array(5_000_000)], "GOM Rev 12.pdf", { type: "application/pdf" });

async function chooseAndSend(limits: { direct_uploads: boolean; max_bytes: number } | null) {
  const user = userEvent.setup();
  render(<UploadVersionDrawer documentId="d-1" limits={limits} />);
  await user.click(screen.getByRole("button", { name: "+ Upload New Version" }));
  await user.upload(screen.getByLabelText(/File/), BIG);
  await user.type(screen.getByPlaceholderText(/Rev 3\.2/), "Rev 12");
  // Submitted directly, as the other drawer tests do: jsdom's check of a
  // required file input would otherwise stop the submit.
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
  return user;
}

beforeEach(() => vi.clearAllMocks());

describe("uploading a large version (#17)", () => {
  it("sends a file over 3.8 MB straight to storage, then refreshes", async () => {
    uploadLargeVersion.mockResolvedValue(null);
    await chooseAndSend({ direct_uploads: true, max_bytes: 52428800 });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(uploadLargeVersion).toHaveBeenCalledWith("d-1", expect.any(File), "Rev 12", expect.any(Function));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says the limit is 50 MB when the server has a bucket", async () => {
    const user = userEvent.setup();
    render(<UploadVersionDrawer documentId="d-1" limits={{ direct_uploads: true, max_bytes: 52428800 }} />);
    await user.click(screen.getByRole("button", { name: "+ Upload New Version" }));
    expect(screen.getByText("Max 50 MB.")).toBeInTheDocument();
  });

  it("keeps the 3.8 MB cap, and says so, without a bucket", async () => {
    await chooseAndSend(null);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "GOM Rev 12.pdf is too large: files over 3.8 MB can't be uploaded on this server.",
    );
    expect(uploadLargeVersion).not.toHaveBeenCalled();
  });

  it("shows why it failed and stays open", async () => {
    uploadLargeVersion.mockResolvedValue("The file couldn't be sent to storage. Check the connection and try again.");
    await chooseAndSend({ direct_uploads: true, max_bytes: 52428800 });
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be sent to storage/);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
