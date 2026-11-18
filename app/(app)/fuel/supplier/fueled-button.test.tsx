import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { markFueledAction } = vi.hoisted(() => ({
  markFueledAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./fueled-action", () => ({ markFueledAction }));

import { MarkFueledButton } from "./fueled-button";

beforeEach(() => {
  markFueledAction.mockReset();
});

describe("MarkFueledButton", () => {
  it("renders the collapsed trigger by default", () => {
    render(
      <MarkFueledButton
        orderId="o-1"
        tail="N207GE"
        requestedGallons={100}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^mark fueled$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/your name/i)).toBeNull();
  });

  it("opens the panel pre-filled with the requested gallons", () => {
    render(
      <MarkFueledButton
        orderId="o-1"
        tail="N207GE"
        requestedGallons={100}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^mark fueled$/i }));
    const actuals = screen.getByLabelText(/actual gallons/i) as HTMLInputElement;
    expect(actuals.value).toBe("100");
    expect(
      screen.getByText(/Off by >5% from 100 auto-flags as discrepancy/i),
    ).toBeInTheDocument();
  });

  it("Cancel collapses without firing", () => {
    render(
      <MarkFueledButton
        orderId="o-1"
        tail="N207GE"
        requestedGallons={100}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^mark fueled$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByLabelText(/actual gallons/i)).toBeNull();
    expect(markFueledAction).not.toHaveBeenCalled();
  });

  it("shows the tail in the panel title", () => {
    render(
      <MarkFueledButton
        orderId="o-1"
        tail="N510PA"
        requestedGallons={250}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^mark fueled$/i }));
    expect(screen.getByText(/mark fueled for/i)).toBeInTheDocument();
    expect(screen.getByText("N510PA")).toBeInTheDocument();
  });

  it("asks for each tank of an order placed left and right (the client, 18 Nov)", async () => {
    markFueledAction.mockResolvedValueOnce({ status: "ok", resulting_status: "fueled" });
    render(
      <MarkFueledButton orderId="o-1" tail="N207GE" requestedGallons={50} requestedLeft={25} requestedRight={25} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^mark fueled$/i }));
    expect(screen.queryByLabelText(/actual gallons/i)).toBeNull();
    expect(screen.getByText("Ordered 25 L / 25 R. A tank off by >5% auto-flags as discrepancy.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Sarah" } });
    fireEvent.change(screen.getByLabelText(/left tank/i), { target: { value: "26" } });
    fireEvent.change(screen.getByLabelText(/right tank/i), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
    await vi.waitFor(() =>
      expect(markFueledAction).toHaveBeenCalledWith("o-1", "Sarah", "50", "", { left: "26", right: "24" }),
    );
  });
});
