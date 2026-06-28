import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { approveCpReviewAction, declineCpReviewAction } = vi.hoisted(() => ({
  approveCpReviewAction: vi.fn(),
  declineCpReviewAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./decide-actions", () => ({
  approveCpReviewAction,
  declineCpReviewAction,
}));

import { CpReviewDecideButtons } from "./decide-buttons";

beforeEach(() => {
  approveCpReviewAction.mockReset();
  declineCpReviewAction.mockReset();
});

describe("CpReviewDecideButtons", () => {
  it("renders both triggers collapsed by default", () => {
    render(<CpReviewDecideButtons reviewId="r-1" action="reopen" />);
    expect(
      screen.getByRole("button", { name: /^approve$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^decline$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/note/i)).toBeNull();
  });

  it("Approve opens a reopen-specific panel", () => {
    render(<CpReviewDecideButtons reviewId="r-1" action="reopen" />);
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(screen.getByText(/approve reopen\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/returns to draft so the pilot can edit/i),
    ).toBeInTheDocument();
  });

  it("Approve opens a delete-specific panel for delete actions", () => {
    render(<CpReviewDecideButtons reviewId="r-1" action="delete" />);
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(screen.getByText(/approve delete\?/i)).toBeInTheDocument();
    expect(screen.getByText(/soft-deleted/i)).toBeInTheDocument();
  });

  it("Decline opens the decline panel", () => {
    render(<CpReviewDecideButtons reviewId="r-1" action="reopen" />);
    fireEvent.click(screen.getByRole("button", { name: /^decline$/i }));
    expect(screen.getByText(/decline this request\?/i)).toBeInTheDocument();
  });

  it("Cancel collapses without firing", () => {
    render(<CpReviewDecideButtons reviewId="r-1" action="reopen" />);
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByLabelText(/note/i)).toBeNull();
    expect(approveCpReviewAction).not.toHaveBeenCalled();
  });
});
