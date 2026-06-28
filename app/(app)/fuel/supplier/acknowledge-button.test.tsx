import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { acknowledgeOrderAction } = vi.hoisted(() => ({
  acknowledgeOrderAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./acknowledge-action", () => ({ acknowledgeOrderAction }));

import { AcknowledgeButton } from "./acknowledge-button";

beforeEach(() => {
  acknowledgeOrderAction.mockReset();
});

describe("AcknowledgeButton", () => {
  it("renders the collapsed trigger button by default", () => {
    render(<AcknowledgeButton orderId="o-1" tail="N207GE" />);
    expect(
      screen.getByRole("button", { name: /^acknowledge$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/your name/i)).toBeNull();
  });

  it("opens the inline panel on click and shows the tail in the title", () => {
    render(<AcknowledgeButton orderId="o-1" tail="N207GE" />);
    fireEvent.click(
      screen.getByRole("button", { name: /^acknowledge$/i }),
    );
    expect(screen.getByText(/acknowledge order for/i)).toBeInTheDocument();
    expect(screen.getByText("N207GE")).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/note \(optional\)/i)).toBeInTheDocument();
  });

  it("Cancel collapses the panel without firing the action", () => {
    render(<AcknowledgeButton orderId="o-1" tail="N207GE" />);
    fireEvent.click(screen.getByRole("button", { name: /^acknowledge$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByLabelText(/your name/i)).toBeNull();
    expect(acknowledgeOrderAction).not.toHaveBeenCalled();
  });
});
