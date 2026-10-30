import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { book, refresh } = vi.hoisted(() => ({ book: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(app)/housing/actions", () => ({ createHousingBookingAction: book }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {}, apiFetch: vi.fn() }));

import { BookStayDialog } from "./book-stay-dialog";

const ROOMS = [
  { id: "r-1", label: "01 (Single, holds 1)" },
  { id: "r-2", label: "02 (Double, holds 2)" },
];
const PEOPLE = [{ id: "p-1", name: "Tomas Eklund" }];

beforeEach(() => {
  book.mockReset();
  refresh.mockReset();
});

describe("BookStayDialog (#158)", () => {
  it("books a stay from a calendar night, the room and nights filled in", async () => {
    book.mockResolvedValue({ ok: true, data: { id: "b-1" } });
    const user = userEvent.setup();
    render(
      <BookStayDialog rooms={ROOMS} people={PEOPLE} roomId="r-2" checkIn="2026-10-30" trigger="cell" triggerLabel="+" />,
    );
    await user.click(screen.getByRole("button", { name: "Book a stay from 2026-10-30" }));
    expect(screen.getByLabelText("Room")).toHaveValue("r-2");
    expect(screen.getByLabelText("Check-in")).toHaveValue("2026-10-30");
    expect(screen.getByLabelText("Check-out")).toHaveValue("2026-10-31");
    await user.selectOptions(screen.getByLabelText("Employee"), "p-1");
    await user.click(screen.getByRole("button", { name: "Book" }));
    const form = book.mock.calls[0][1] as FormData;
    expect([form.get("employee_user_id"), form.get("room_id"), form.get("purpose")]).toEqual([
      "p-1",
      "r-2",
      "crew_rest",
    ]);
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the service's refusal as it comes", async () => {
    book.mockResolvedValue({
      ok: false,
      error: "Room 01 holds 1, and it's booked then: Alice Chen Oct 30–Nov 2.",
    });
    const user = userEvent.setup();
    render(<BookStayDialog rooms={ROOMS} people={PEOPLE} />);
    await user.click(screen.getByRole("button", { name: "Book a stay" }));
    await user.selectOptions(screen.getByLabelText("Employee"), "p-1");
    await user.selectOptions(screen.getByLabelText("Room"), "r-1");
    await user.type(screen.getByLabelText("Check-in"), "2026-10-31");
    await user.click(screen.getByRole("button", { name: "Book" }));
    expect(await screen.findByText(/Room 01 holds 1/)).toBeInTheDocument();
  });
});
