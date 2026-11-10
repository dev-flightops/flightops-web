import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setTaskStatusAction, fileTaskDocumentAction } = vi.hoisted(() => ({
  setTaskStatusAction: vi.fn(async () => ({ ok: true as const })),
  fileTaskDocumentAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("./actions", () => ({ setTaskStatusAction, fileTaskDocumentAction }));

import { TaskActions } from "./task-actions";
import { task } from "./test-fixtures";

beforeEach(() => vi.clearAllMocks());

describe("what can be done to an onboarding task (#180)", () => {
  it("offers nothing when the task isn't the reader's", () => {
    const { container } = render(<TaskActions assignmentId="a-1" task={task({ can_act: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks an open task done or started", async () => {
    render(<TaskActions assignmentId="a-1" task={task()} />);
    fireEvent.click(screen.getByRole("button", { name: "Started: Read the GOM" }));
    await waitFor(() => expect(setTaskStatusAction).toHaveBeenCalledWith("a-1", "t-1", "in_progress", ""));
    fireEvent.click(screen.getByRole("button", { name: "Done: Read the GOM" }));
    await waitFor(() => expect(setTaskStatusAction).toHaveBeenCalledWith("a-1", "t-1", "complete", ""));
  });

  it("asks why before skipping, and shows a refusal", async () => {
    setTaskStatusAction.mockResolvedValueOnce({ ok: false, message: "Say why it's skipped." } as never);
    render(<TaskActions assignmentId="a-1" task={task({ status: "in_progress" })} />);
    expect(screen.queryByRole("button", { name: "Started: Read the GOM" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip: Read the GOM" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip Task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Say why it's skipped.");
    fireEvent.change(screen.getByLabelText("Why it's skipped"), { target: { value: "Done at the last carrier" } });
    fireEvent.click(screen.getByRole("button", { name: "Skip Task" }));
    await waitFor(() =>
      expect(setTaskStatusAction).toHaveBeenLastCalledWith("a-1", "t-1", "skipped", "Done at the last carrier"),
    );
  });

  it("reopens a done task", async () => {
    render(<TaskActions assignmentId="a-1" task={task({ status: "complete" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Reopen: Read the GOM" }));
    await waitFor(() => expect(setTaskStatusAction).toHaveBeenCalledWith("a-1", "t-1", "pending", ""));
  });

  it("uploads a Document Upload task's file, its expiry required when the document has one", async () => {
    render(
      <TaskActions
        assignmentId="a-1"
        task={task({
          name: "Upload medical",
          task_type: "document_upload",
          document_requirement: { id: "r-1", name: "Medical Certificate", has_expiry: true },
        })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Done: Upload medical" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload: Upload medical" }));
    const form = screen.getByRole("form", { name: "Upload Medical Certificate" });
    expect(form).toHaveAttribute("method", "post");
    expect(screen.getByText(/Filed in the employee's Documents as Medical Certificate/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expires/)).toBeRequired();
    fireEvent.submit(form);
    await waitFor(() => expect(fileTaskDocumentAction).toHaveBeenCalledWith("a-1", "t-1", expect.any(FormData)));
    // Or done with the one already in their Documents.
    fireEvent.click(screen.getByRole("button", { name: "Upload: Upload medical" }));
    fireEvent.click(screen.getByRole("button", { name: "Use the one on file" }));
    await waitFor(() => expect(setTaskStatusAction).toHaveBeenCalledWith("a-1", "t-1", "complete", ""));
  });
});
